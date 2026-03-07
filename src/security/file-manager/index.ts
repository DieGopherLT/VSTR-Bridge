import * as path from 'path';
import * as os from 'os';
import { defaultFileSystem } from './default-fs';
import { extractPermissionBits } from './permissions';
export type { FileSystem, SecureBridgeInfo } from './types';
import type { FileSystem, SecureBridgeInfo } from './types';

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

      const mode = extractPermissionBits(stats);

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
      const resolvedPath = path.resolve(filePath);
      const resolvedBridgeDir = path.resolve(this.bridgeDir);

      if (!resolvedPath.startsWith(resolvedBridgeDir + path.sep)) {
        throw new Error('Attempting to delete file outside bridge directory');
      }

      if (this.fileSystem.existsSync(resolvedPath)) {
        this.fileSystem.unlinkSync(resolvedPath);
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
