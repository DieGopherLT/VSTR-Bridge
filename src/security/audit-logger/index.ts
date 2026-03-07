import * as path from 'path';
import { SecurityEvent } from '../types';
import type { FileSystem } from '../file-manager/types';
import { defaultFileSystem } from '../file-manager/default-fs';
import { extractPermissionBits } from '../file-manager/permissions';

export interface NotificationHandler {
  showError(message: string, ...actions: string[]): Promise<string | undefined>;
  showWarning(message: string): void;
  openFile(filePath: string): void;
}

export interface AuditLoggerConfig {
  bridgeDir: string;
  maxLogSize?: number;
  maxLogFiles?: number;
  fileSystem?: FileSystem;
  notificationHandler?: NotificationHandler | null;
}

export class AuditLogger {
  private logPath: string;
  private maxLogSize: number;
  private maxLogFiles: number;
  private readonly fileSystem: FileSystem;
  private readonly notificationHandler: NotificationHandler | null;

  constructor({
    bridgeDir,
    maxLogSize = 10 * 1024 * 1024,
    maxLogFiles = 5,
    fileSystem = defaultFileSystem,
    notificationHandler = null,
  }: AuditLoggerConfig) {
    this.logPath = path.join(bridgeDir, 'audit.log');
    this.maxLogSize = maxLogSize;
    this.maxLogFiles = maxLogFiles;
    this.fileSystem = fileSystem;
    this.notificationHandler = notificationHandler;
  }

  public initialize(): void {
    try {
      if (!this.fileSystem.existsSync(this.logPath)) {
        this.fileSystem.writeFileSync(this.logPath, '', { mode: 0o600 });
      } else {
        const stats = this.fileSystem.statSync(this.logPath);
        const mode = extractPermissionBits(stats);

        if (process.platform !== 'win32' && mode > 0o600) {
          this.fileSystem.chmodSync(this.logPath, 0o600);
        }
      }
    } catch (error) {
      console.error('Failed to initialize audit log:', error);
    }
  }

  public logSecurityEvent(event: SecurityEvent): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: event.type,
      details: event.details,
      clientId: this.sanitizeClientId(event.clientId),
      severity: event.severity,
      bridge_version: '0.1.2',
    };

    try {
      this.writeLogEntry(logEntry);
      this.notifyForSeverity(event);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private notifyForSeverity(event: SecurityEvent): void {
    if (!this.notificationHandler) {
      return;
    }

    if (event.severity === 'critical') {
      this.notificationHandler.showError(`Security Alert: ${event.details}`, 'View Logs').then((selection) => {
        if (selection === 'View Logs') {
          this.notificationHandler!.openFile(this.logPath);
        }
      });
      return;
    }

    if (event.severity === 'high') {
      this.notificationHandler.showWarning(`Security Warning: ${event.details}`);
    }
  }

  private writeLogEntry(logEntry: any): void {
    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      this.checkLogRotation();
      this.fileSystem.appendFileSync(this.logPath, logLine, { mode: 0o600 });
    } catch (error) {
      throw new Error(`Failed to write log entry: ${error}`);
    }
  }

  private checkLogRotation(): void {
    try {
      const stats = this.fileSystem.statSync(this.logPath);

      if (stats.size >= this.maxLogSize) {
        this.rotateLog();
      }
    } catch {
      // If file cannot be read, continue without rotation
    }
  }

  private rotateLog(): void {
    try {
      const logDir = path.dirname(this.logPath);
      const logBaseName = path.basename(this.logPath, '.log');

      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldFile = path.join(logDir, `${logBaseName}.${i}.log`);
        const newFile = path.join(logDir, `${logBaseName}.${i + 1}.log`);

        if (this.fileSystem.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            this.fileSystem.unlinkSync(oldFile);
          } else {
            this.fileSystem.renameSync(oldFile, newFile);
          }
        }
      }

      const firstRotated = path.join(logDir, `${logBaseName}.1.log`);
      this.fileSystem.renameSync(this.logPath, firstRotated);

      this.fileSystem.writeFileSync(this.logPath, '', { mode: 0o600 });
    } catch (error) {
      console.error('Failed to rotate log:', error);
    }
  }

  private sanitizeClientId(clientId: string): string {
    return clientId.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, '[IP_REDACTED]');
  }

  public logAuthFailure(clientId: string, reason = 'Authentication failed'): void {
    this.logSecurityEvent({
      type: 'auth_failure',
      details: reason,
      clientId: clientId,
      severity: 'critical',
    });
  }

  public logCommandBlocked(cmd: string, reason: string, clientId: string): void {
    this.logSecurityEvent({
      type: 'command_blocked',
      details: `Command "${this.sanitizeCommand(cmd)}" blocked: ${reason}`,
      clientId: clientId,
      severity: 'high',
    });
  }

  public logRateLimitExceeded(clientId: string): void {
    this.logSecurityEvent({
      type: 'rate_limit_exceeded',
      details: 'Client exceeded rate limit and was temporarily blocked',
      clientId: clientId,
      severity: 'medium',
    });
  }

  public logSuspiciousActivity(activity: string, clientId: string): void {
    this.logSecurityEvent({
      type: 'suspicious_activity',
      details: activity,
      clientId: clientId,
      severity: 'high',
    });
  }

  private sanitizeCommand(cmd: string): string {
    if (cmd.length > 100) {
      cmd = cmd.substring(0, 97) + '...';
    }

    return cmd.replace(/([a-f0-9]{32,}|[A-Za-z0-9+/]{20,}=*)/g, '[REDACTED]');
  }

  public getLogPath(): string {
    return this.logPath;
  }

  public getLogStats(): { size: number; entries: number } {
    try {
      const content = this.fileSystem.readFileSync(this.logPath, 'utf8');
      const lines = content.split('\n').filter((line) => line.trim());

      return {
        size: this.fileSystem.statSync(this.logPath).size,
        entries: lines.length,
      };
    } catch {
      return { size: 0, entries: 0 };
    }
  }

  public clearLogs(): void {
    try {
      this.fileSystem.writeFileSync(this.logPath, '', { mode: 0o600 });
    } catch (error) {
      throw new Error(`Failed to clear logs: ${error}`);
    }
  }
}
