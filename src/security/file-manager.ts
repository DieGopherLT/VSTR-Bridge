import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SecureBridgeInfo {
  port: number;
  pid: number;
  instance_id: number;
  workspace_path: string;
  workspace_name: string;
  timestamp: string;
  auth_token: string;
  secure: boolean;
}

export interface FileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): void;
  writeFileSync(path: string, data: string, options?: { mode?: number }): void;
  readFileSync(path: string, encoding: string): string;
  statSync(path: string): fs.Stats;
  chmodSync(path: string, mode: number): void;
  readdirSync(path: string): string[];
  unlinkSync(path: string): void;
  appendFileSync(path: string, data: string, options?: { mode?: number }): void;
  renameSync(oldPath: string, newPath: string): void;
}

const defaultFileSystem: FileSystem = {
  existsSync: fs.existsSync,
  mkdirSync: (p, opts) => {
    fs.mkdirSync(p, opts);
  },
  writeFileSync: (p, data, opts) => {
    fs.writeFileSync(p, data, opts as fs.WriteFileOptions);
  },
  readFileSync: (p, enc) => fs.readFileSync(p, enc as BufferEncoding),
  statSync: fs.statSync,
  chmodSync: fs.chmodSync,
  readdirSync: (p) => fs.readdirSync(p) as string[],
  unlinkSync: fs.unlinkSync,
  appendFileSync: (p, data, opts) => {
    fs.appendFileSync(p, data, opts as fs.WriteFileOptions);
  },
  renameSync: fs.renameSync,
};

export class SecureFileManager {
  private bridgeDir: string;
  private readonly SECURE_DIR_MODE = 0o700;
  private readonly SECURE_FILE_MODE = 0o600;
  private readonly fileSystem: FileSystem;

  constructor(fileSystem: FileSystem = defaultFileSystem) {
    this.fileSystem = fileSystem;
    this.bridgeDir = path.join(os.tmpdir(), 'vstr-bridge');
  }

  public initialize(): void {
    try {
      if (!this.fileSystem.existsSync(this.bridgeDir)) {
        this.fileSystem.mkdirSync(this.bridgeDir, {
          recursive: true,
          mode: this.SECURE_DIR_MODE,
        });
      } else {
        this.ensureSecurePermissions(this.bridgeDir, this.SECURE_DIR_MODE, true);
      }
    } catch (error) {
      throw new Error(`Failed to create secure bridge directory: ${error}`);
    }
  }

  public writeBridgeInfo(info: SecureBridgeInfo): string {
    const filePath = path.join(this.bridgeDir, `bridge-${info.port}.json`);

    try {
      this.fileSystem.writeFileSync(filePath, JSON.stringify(info, null, 2), { mode: this.SECURE_FILE_MODE });

      if (!this.validateFilePermissions(filePath)) {
        throw new Error('Failed to set secure file permissions');
      }

      return filePath;
    } catch (error) {
      throw new Error(`Failed to write secure bridge info: ${error}`);
    }
  }

  public readBridgeInfo(filePath: string): SecureBridgeInfo {
    if (!this.validateFilePermissions(filePath)) {
      throw new Error('Bridge info file has insecure permissions');
    }

    try {
      const content = this.fileSystem.readFileSync(filePath, 'utf8');
      const info = JSON.parse(content) as SecureBridgeInfo;

      this.validateBridgeInfoStructure(info);

      return info;
    } catch (error) {
      throw new Error(`Failed to read bridge info: ${error}`);
    }
  }

  public validateFilePermissions(filePath: string): boolean {
    try {
      const stats = this.fileSystem.statSync(filePath);

      if (process.platform === 'win32') {
        return stats.isFile();
      }

      const mode = stats.mode & parseInt('777', 8);

      return mode === 0o600 || mode === 0o400;
    } catch {
      return false;
    }
  }

  public ensureSecurePermissions(targetPath: string, mode: number, isDirectory = false): void {
    try {
      if (process.platform !== 'win32') {
        this.fileSystem.chmodSync(targetPath, mode);

        if (isDirectory) {
          const files = this.fileSystem.readdirSync(targetPath);
          for (const file of files) {
            const filePath = path.join(targetPath, file);
            const stats = this.fileSystem.statSync(filePath);

            if (stats.isFile()) {
              this.fileSystem.chmodSync(filePath, this.SECURE_FILE_MODE);
            } else if (stats.isDirectory()) {
              this.ensureSecurePermissions(filePath, this.SECURE_DIR_MODE, true);
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to set secure permissions: ${error}`);
    }
  }

  public cleanupBridgeFile(filePath: string): void {
    try {
      if (this.fileSystem.existsSync(filePath)) {
        if (!filePath.startsWith(this.bridgeDir)) {
          throw new Error('Attempting to delete file outside bridge directory');
        }

        this.fileSystem.unlinkSync(filePath);
      }
    } catch (error) {
      throw new Error(`Failed to cleanup bridge file: ${error}`);
    }
  }

  public listBridgeFiles(): string[] {
    try {
      const files = this.fileSystem.readdirSync(this.bridgeDir);
      return files
        .filter((file) => file.startsWith('bridge-') && file.endsWith('.json'))
        .map((file) => path.join(this.bridgeDir, file));
    } catch {
      return [];
    }
  }

  public cleanupStaleFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    let cleanedCount = 0;
    const now = Date.now();

    try {
      const bridgeFiles = this.listBridgeFiles();

      for (const filePath of bridgeFiles) {
        try {
          const stats = this.fileSystem.statSync(filePath);
          const age = now - stats.mtime.getTime();

          if (age > maxAgeMs) {
            this.cleanupBridgeFile(filePath);
            cleanedCount++;
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Ignore directory errors
    }

    return cleanedCount;
  }

  private validateBridgeInfoStructure(info: any): void {
    const requiredFields = ['port', 'pid', 'auth_token', 'secure'];

    for (const field of requiredFields) {
      if (!(field in info)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof info.port !== 'number' || info.port <= 0) {
      throw new Error('Invalid port number');
    }

    if (typeof info.auth_token !== 'string' || info.auth_token.length < 32) {
      throw new Error('Invalid auth token');
    }

    if (info.secure !== true) {
      throw new Error('Bridge info indicates insecure configuration');
    }
  }

  public getBridgeDirectory(): string {
    return this.bridgeDir;
  }
}
