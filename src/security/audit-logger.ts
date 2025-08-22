import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SecurityEvent } from './types';

export class AuditLogger {
    private logPath: string;
    private maxLogSize: number;
    private maxLogFiles: number;

    constructor(bridgeDir: string, maxLogSize = 10 * 1024 * 1024, maxLogFiles = 5) { // 10MB, 5 archivos
        this.logPath = path.join(bridgeDir, 'audit.log');
        this.maxLogSize = maxLogSize;
        this.maxLogFiles = maxLogFiles;
        this.initializeLogFile();
    }

    private initializeLogFile(): void {
        try {
            // Crear archivo de log si no existe
            if (!fs.existsSync(this.logPath)) {
                fs.writeFileSync(this.logPath, '', { mode: 0o600 });
            } else {
                // Verificar permisos del archivo existente
                const stats = fs.statSync(this.logPath);
                const mode = stats.mode & parseInt('777', 8);
                
                if (process.platform !== 'win32' && mode > 0o600) {
                    fs.chmodSync(this.logPath, 0o600);
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
            bridge_version: '0.1.2'
        };

        try {
            this.writeLogEntry(logEntry);
            
            // Mostrar alertas críticas en VSCode
            if (event.severity === 'critical') {
                vscode.window.showErrorMessage(
                    `Security Alert: ${event.details}`,
                    'View Logs'
                ).then(selection => {
                    if (selection === 'View Logs') {
                        this.openLogFile();
                    }
                });
            } else if (event.severity === 'high') {
                vscode.window.showWarningMessage(
                    `Security Warning: ${event.details}`
                );
            }
        } catch (error) {
            console.error('Failed to log security event:', error);
        }
    }

    private writeLogEntry(logEntry: any): void {
        const logLine = JSON.stringify(logEntry) + '\n';
        
        try {
            // Verificar rotación de logs antes de escribir
            this.checkLogRotation();
            
            fs.appendFileSync(this.logPath, logLine, { mode: 0o600 });
        } catch (error) {
            throw new Error(`Failed to write log entry: ${error}`);
        }
    }

    private checkLogRotation(): void {
        try {
            const stats = fs.statSync(this.logPath);
            
            if (stats.size >= this.maxLogSize) {
                this.rotateLog();
            }
        } catch {
            // Si no se puede leer el archivo, continuar sin rotación
        }
    }

    private rotateLog(): void {
        try {
            const logDir = path.dirname(this.logPath);
            const logBaseName = path.basename(this.logPath, '.log');
            
            // Rotar archivos existentes
            for (let i = this.maxLogFiles - 1; i >= 1; i--) {
                const oldFile = path.join(logDir, `${logBaseName}.${i}.log`);
                const newFile = path.join(logDir, `${logBaseName}.${i + 1}.log`);
                
                if (fs.existsSync(oldFile)) {
                    if (i === this.maxLogFiles - 1) {
                        // Eliminar el archivo más antiguo
                        fs.unlinkSync(oldFile);
                    } else {
                        fs.renameSync(oldFile, newFile);
                    }
                }
            }
            
            // Mover el archivo actual
            const firstRotated = path.join(logDir, `${logBaseName}.1.log`);
            fs.renameSync(this.logPath, firstRotated);
            
            // Crear nuevo archivo de log
            fs.writeFileSync(this.logPath, '', { mode: 0o600 });
        } catch (error) {
            console.error('Failed to rotate log:', error);
        }
    }

    private sanitizeClientId(clientId: string): string {
        // Remover información sensible del clientId
        return clientId.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, '[IP_REDACTED]');
    }

    private openLogFile(): void {
        try {
            vscode.workspace.openTextDocument(this.logPath).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to open log file');
        }
    }

    // Métodos de conveniencia para eventos específicos
    public logAuthFailure(clientId: string, reason = 'Authentication failed'): void {
        this.logSecurityEvent({
            type: 'auth_failure',
            details: reason,
            clientId: clientId,
            severity: 'critical'
        });
    }

    public logCommandBlocked(cmd: string, reason: string, clientId: string): void {
        this.logSecurityEvent({
            type: 'command_blocked',
            details: `Command "${this.sanitizeCommand(cmd)}" blocked: ${reason}`,
            clientId: clientId,
            severity: 'high'
        });
    }

    public logRateLimitExceeded(clientId: string): void {
        this.logSecurityEvent({
            type: 'rate_limit_exceeded',
            details: 'Client exceeded rate limit and was temporarily blocked',
            clientId: clientId,
            severity: 'medium'
        });
    }

    public logSuspiciousActivity(activity: string, clientId: string): void {
        this.logSecurityEvent({
            type: 'suspicious_activity',
            details: activity,
            clientId: clientId,
            severity: 'high'
        });
    }

    private sanitizeCommand(cmd: string): string {
        // Truncar comandos muy largos y remover información sensible
        if (cmd.length > 100) {
            cmd = cmd.substring(0, 97) + '...';
        }
        
        // Remover tokens o claves que puedan estar en el comando
        return cmd.replace(/([a-f0-9]{32,}|[A-Za-z0-9+/]{20,}=*)/g, '[REDACTED]');
    }

    public getLogPath(): string {
        return this.logPath;
    }

    public getLogStats(): { size: number; entries: number } {
        try {
            const content = fs.readFileSync(this.logPath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            return {
                size: fs.statSync(this.logPath).size,
                entries: lines.length
            };
        } catch {
            return { size: 0, entries: 0 };
        }
    }

    public clearLogs(): void {
        try {
            fs.writeFileSync(this.logPath, '', { mode: 0o600 });
        } catch (error) {
            throw new Error(`Failed to clear logs: ${error}`);
        }
    }
}