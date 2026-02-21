import * as os from 'os';
import * as path from 'path';
import { FileSystem, SecureBridgeInfo, SecureFileManager } from './file-manager';

const buildMockFs = (): jest.Mocked<FileSystem> => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  chmodSync: jest.fn(),
  statSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  appendFileSync: jest.fn(),
  renameSync: jest.fn(),
});

const buildBridgeInfo = (overrides: Partial<SecureBridgeInfo> = {}): SecureBridgeInfo => ({
  port: 3000,
  pid: 12345,
  instance_id: 1,
  workspace_path: '/home/user/project',
  workspace_name: 'project',
  timestamp: '2026-01-01T00:00:00.000Z',
  auth_token: 'a'.repeat(32),
  secure: true,
  ...overrides,
});

const bridgeDir = path.join(os.tmpdir(), 'vstr-bridge');

describe('SecureFileManager', () => {
  let mockFs: jest.Mocked<FileSystem>;

  beforeEach(() => {
    mockFs = buildMockFs();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('creates the bridge directory when it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const manager = new SecureFileManager(mockFs);

      manager.initialize();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(bridgeDir, {
        recursive: true,
        mode: 0o700,
      });
    });

    it('applies secure permissions when the directory already exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);
      const manager = new SecureFileManager(mockFs);

      manager.initialize();

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
      expect(mockFs.chmodSync).toHaveBeenCalledWith(bridgeDir, 0o700);
    });
  });

  describe('writeBridgeInfo', () => {
    it('writes JSON with all bridge info fields to the correct path', () => {
      const info = buildBridgeInfo();
      const expectedPath = path.join(bridgeDir, `bridge-${info.port}.json`);
      mockFs.statSync.mockReturnValue({ mode: 0o100600, isFile: () => true } as any);
      const manager = new SecureFileManager(mockFs);

      const resultPath = manager.writeBridgeInfo(info);

      expect(resultPath).toBe(expectedPath);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(expectedPath, expect.stringContaining('"auth_token"'), {
        mode: 0o600,
      });
    });

    it('writes JSON that contains the port and secure fields', () => {
      const info = buildBridgeInfo({ port: 8080 });
      mockFs.statSync.mockReturnValue({ mode: 0o100600, isFile: () => true } as any);
      const manager = new SecureFileManager(mockFs);

      manager.writeBridgeInfo(info);

      const writtenJson = mockFs.writeFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenJson);
      expect(parsed.port).toBe(8080);
      expect(parsed.secure).toBe(true);
    });
  });

  describe('readBridgeInfo', () => {
    it('returns parsed bridge info when the file has secure permissions', () => {
      const info = buildBridgeInfo();
      const filePath = path.join(bridgeDir, 'bridge-3000.json');
      mockFs.statSync.mockReturnValue({ mode: 0o100600, isFile: () => true } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(info));
      const manager = new SecureFileManager(mockFs);

      const result = manager.readBridgeInfo(filePath);

      expect(result.port).toBe(info.port);
      expect(result.auth_token).toBe(info.auth_token);
    });

    it('throws when the file has insecure permissions', () => {
      const filePath = path.join(bridgeDir, 'bridge-3000.json');
      mockFs.statSync.mockReturnValue({ mode: 0o100644, isFile: () => true } as any);
      const manager = new SecureFileManager(mockFs);

      expect(() => manager.readBridgeInfo(filePath)).toThrow('insecure permissions');
    });

    it('throws when the file does not exist', () => {
      const filePath = path.join(bridgeDir, 'bridge-3000.json');
      mockFs.statSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      const manager = new SecureFileManager(mockFs);

      expect(() => manager.readBridgeInfo(filePath)).toThrow();
    });
  });

  describe('validateFilePermissions', () => {
    it('returns false when the file does not exist', () => {
      mockFs.statSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      const manager = new SecureFileManager(mockFs);

      const isValid = manager.validateFilePermissions('/nonexistent/path');

      expect(isValid).toBe(false);
    });

    it('returns true when the file has mode 0o600', () => {
      mockFs.statSync.mockReturnValue({ mode: 0o100600, isFile: () => true } as any);
      const manager = new SecureFileManager(mockFs);

      const isValid = manager.validateFilePermissions('/some/file');

      expect(isValid).toBe(true);
    });
  });

  describe('cleanupStaleFiles', () => {
    it('deletes bridge files older than the max age', () => {
      const staleFilePath = path.join(bridgeDir, 'bridge-9999.json');
      const oldMtime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockFs.readdirSync.mockReturnValue(['bridge-9999.json'] as any);
      mockFs.statSync.mockReturnValue({ mtime: oldMtime } as any);
      mockFs.existsSync.mockReturnValue(true);
      const manager = new SecureFileManager(mockFs);

      const cleaned = manager.cleanupStaleFiles(24 * 60 * 60 * 1000);

      expect(cleaned).toBe(1);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(staleFilePath);
    });

    it('does not delete bridge files newer than the max age', () => {
      const freshMtime = new Date(Date.now() - 1000);
      mockFs.readdirSync.mockReturnValue(['bridge-9999.json'] as any);
      mockFs.statSync.mockReturnValue({ mtime: freshMtime } as any);
      const manager = new SecureFileManager(mockFs);

      const cleaned = manager.cleanupStaleFiles(24 * 60 * 60 * 1000);

      expect(cleaned).toBe(0);
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});
