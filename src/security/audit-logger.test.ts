import * as path from 'path';
import { AuditLogger, NotificationHandler } from './audit-logger';
import { FileSystem } from './file-manager';

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

const buildMockNotificationHandler = (): jest.Mocked<NotificationHandler> => ({
  showError: jest.fn().mockResolvedValue(undefined),
  showWarning: jest.fn(),
  openFile: jest.fn(),
});

const bridgeDir = '/tmp/vstr-bridge';
const logPath = path.join(bridgeDir, 'audit.log');

describe('AuditLogger', () => {
  let mockFs: jest.Mocked<FileSystem>;
  let mockNotificationHandler: jest.Mocked<NotificationHandler>;

  beforeEach(() => {
    mockFs = buildMockFs();
    mockNotificationHandler = buildMockNotificationHandler();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('creates the log file when it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.initialize();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(logPath, '', { mode: 0o600 });
    });

    it('does not create the log file when it already exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mode: 0o100600 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.initialize();

      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('applies secure permissions when the existing file has insecure mode on non-windows', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ mode: 0o100644 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.initialize();

      expect(mockFs.chmodSync).toHaveBeenCalledWith(logPath, 0o600);

      Object.defineProperty(process, 'platform', originalPlatform!);
    });
  });

  describe('logSecurityEvent', () => {
    it('calls appendFileSync to write the log entry', () => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.logSecurityEvent({
        type: 'suspicious_activity',
        details: 'some activity',
        clientId: 'client-1',
        severity: 'low',
      });

      expect(mockFs.appendFileSync).toHaveBeenCalledWith(logPath, expect.stringContaining('"suspicious_activity"'), {
        mode: 0o600,
      });
    });

    it('writes a JSON line that includes the event type and severity', () => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.logSecurityEvent({
        type: 'auth_failure',
        details: 'bad token',
        clientId: 'client-1',
        severity: 'critical',
      });

      const writtenArg = mockFs.appendFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenArg.trim());
      expect(parsed.event).toBe('auth_failure');
      expect(parsed.severity).toBe('critical');
    });

    it('redacts IP addresses from the clientId in the log entry', () => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.logSecurityEvent({
        type: 'suspicious_activity',
        details: 'test',
        clientId: '192.168.1.100',
        severity: 'low',
      });

      const writtenArg = mockFs.appendFileSync.mock.calls[0][1] as string;
      expect(writtenArg).toContain('[IP_REDACTED]');
      expect(writtenArg).not.toContain('192.168.1.100');
    });
  });

  describe('severity notifications', () => {
    it('calls showError on the notification handler for critical severity', () => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs, mockNotificationHandler);

      logger.logSecurityEvent({
        type: 'auth_failure',
        details: 'critical issue',
        clientId: 'client-1',
        severity: 'critical',
      });

      expect(mockNotificationHandler.showError).toHaveBeenCalledWith(
        expect.stringContaining('critical issue'),
        'View Logs'
      );
    });

    it('opens the log file when user selects View Logs on a critical event', async () => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
      mockNotificationHandler.showError.mockResolvedValue('View Logs');
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs, mockNotificationHandler);

      logger.logSecurityEvent({
        type: 'auth_failure',
        details: 'critical issue',
        clientId: 'client-1',
        severity: 'critical',
      });

      await Promise.resolve();

      expect(mockNotificationHandler.openFile).toHaveBeenCalledWith(logPath);
    });

    it('calls showWarning on the notification handler for high severity', () => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs, mockNotificationHandler);

      logger.logSecurityEvent({
        type: 'suspicious_activity',
        details: 'high severity issue',
        clientId: 'client-1',
        severity: 'high',
      });

      expect(mockNotificationHandler.showWarning).toHaveBeenCalledWith(expect.stringContaining('high severity issue'));
    });

    it('does not call the notification handler for medium severity', () => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs, mockNotificationHandler);

      logger.logSecurityEvent({
        type: 'rate_limit_exceeded',
        details: 'too many requests',
        clientId: 'client-1',
        severity: 'medium',
      });

      expect(mockNotificationHandler.showError).not.toHaveBeenCalled();
      expect(mockNotificationHandler.showWarning).not.toHaveBeenCalled();
    });

    it('does not call the notification handler for low severity', () => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs, mockNotificationHandler);

      logger.logSecurityEvent({
        type: 'suspicious_activity',
        details: 'minor activity',
        clientId: 'client-1',
        severity: 'low',
      });

      expect(mockNotificationHandler.showError).not.toHaveBeenCalled();
      expect(mockNotificationHandler.showWarning).not.toHaveBeenCalled();
    });

    it('does not call the notification handler when none is provided', () => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs, null);

      expect(() =>
        logger.logSecurityEvent({
          type: 'auth_failure',
          details: 'critical issue',
          clientId: 'client-1',
          severity: 'critical',
        })
      ).not.toThrow();
    });
  });

  describe('getLogStats', () => {
    it('returns size and entry count from the log file', () => {
      const logContent = '{"event":"auth_failure"}\n{"event":"suspicious_activity"}\n';
      mockFs.readFileSync.mockReturnValue(logContent);
      mockFs.statSync.mockReturnValue({ size: logContent.length } as any);
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      const stats = logger.getLogStats();

      expect(stats.entries).toBe(2);
      expect(stats.size).toBe(logContent.length);
    });

    it('returns zeros when reading the log file fails', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      const stats = logger.getLogStats();

      expect(stats.size).toBe(0);
      expect(stats.entries).toBe(0);
    });
  });

  describe('getLogPath', () => {
    it('returns the path to the audit log file', () => {
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      expect(logger.getLogPath()).toBe(logPath);
    });
  });

  describe('convenience log methods', () => {
    beforeEach(() => {
      mockFs.statSync.mockReturnValue({ size: 0 } as any);
    });

    it('logAuthFailure writes an auth_failure event with critical severity', () => {
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.logAuthFailure('client-1');

      const writtenArg = mockFs.appendFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenArg.trim());
      expect(parsed.event).toBe('auth_failure');
      expect(parsed.severity).toBe('critical');
    });

    it('logCommandBlocked writes a command_blocked event with high severity', () => {
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.logCommandBlocked('rm -rf /', 'dangerous command', 'client-1');

      const writtenArg = mockFs.appendFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenArg.trim());
      expect(parsed.event).toBe('command_blocked');
      expect(parsed.severity).toBe('high');
    });

    it('logRateLimitExceeded writes a rate_limit_exceeded event with medium severity', () => {
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.logRateLimitExceeded('client-1');

      const writtenArg = mockFs.appendFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenArg.trim());
      expect(parsed.event).toBe('rate_limit_exceeded');
      expect(parsed.severity).toBe('medium');
    });
  });

  describe('log rotation', () => {
    it('rotates the log file when it exceeds the max size', () => {
      const maxLogSize = 100;
      const logger = new AuditLogger(bridgeDir, maxLogSize, 5, mockFs);
      mockFs.statSync.mockReturnValue({ size: maxLogSize + 1 } as any);
      mockFs.existsSync.mockReturnValue(false);

      logger.logSecurityEvent({
        type: 'suspicious_activity',
        details: 'triggering rotation',
        clientId: 'client-1',
        severity: 'low',
      });

      expect(mockFs.renameSync).toHaveBeenCalledWith(logPath, expect.stringContaining('audit.1.log'));
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(logPath, '', { mode: 0o600 });
    });

    it('renames existing rotated files before rotation', () => {
      const maxLogSize = 100;
      const logger = new AuditLogger(bridgeDir, maxLogSize, 5, mockFs);
      mockFs.statSync.mockReturnValue({ size: maxLogSize + 1 } as any);
      mockFs.existsSync.mockImplementation((p: string) => (p as string).includes('audit.1.log'));

      logger.logSecurityEvent({
        type: 'suspicious_activity',
        details: 'triggering rotation with existing file',
        clientId: 'client-1',
        severity: 'low',
      });

      expect(mockFs.renameSync).toHaveBeenCalledWith(
        expect.stringContaining('audit.1.log'),
        expect.stringContaining('audit.2.log')
      );
    });

    it('deletes the oldest rotated file when it is at maxLogFiles - 1', () => {
      const maxLogSize = 100;
      const maxLogFiles = 3;
      const logger = new AuditLogger(bridgeDir, maxLogSize, maxLogFiles, mockFs);
      mockFs.statSync.mockReturnValue({ size: maxLogSize + 1 } as any);
      mockFs.existsSync.mockImplementation((p: string) => (p as string).includes(`audit.${maxLogFiles - 1}.log`));

      logger.logSecurityEvent({
        type: 'suspicious_activity',
        details: 'triggering rotation with oldest file',
        clientId: 'client-1',
        severity: 'low',
      });

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(`audit.${maxLogFiles - 1}.log`));
    });
  });

  describe('clearLogs', () => {
    it('overwrites the log file with empty content', () => {
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      logger.clearLogs();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(logPath, '', { mode: 0o600 });
    });

    it('throws when the file system operation fails', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      const logger = new AuditLogger(bridgeDir, undefined, undefined, mockFs);

      expect(() => logger.clearLogs()).toThrow('Failed to clear logs');
    });
  });
});
