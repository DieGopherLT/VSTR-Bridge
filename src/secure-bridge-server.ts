import * as vscode from 'vscode';
import * as http from 'http';
import * as os from 'os';
import { 
    SecurityMiddleware, 
    SecureFileManager, 
    SecurityConfig,
    CommandValidationConfig,
    RateLimitConfig
} from './security';

interface TaskConfig {
    name: string;
    path: string;
    cmds: string[];
    icon?: string;
    iconColor?: string;
}

interface WorkspaceConfig {
    name: string;
    tasks: TaskConfig[];
}

export class SecureBridgeServer {
    private server: http.Server | null = null;
    private port: number = 0;
    private context: vscode.ExtensionContext;
    private bridgeInfoPath: string = '';
    private securityMiddleware: SecurityMiddleware;
    private fileManager: SecureFileManager;
    private config: SecurityConfig;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.fileManager = new SecureFileManager();
        this.config = this.loadSecurityConfig();
        this.securityMiddleware = new SecurityMiddleware(
            this.config, 
            this.fileManager.getBridgeDirectory()
        );
    }

    private loadSecurityConfig(): SecurityConfig {
        const vscodeConfig = vscode.workspace.getConfiguration('vstrBridge.security');
        
        const rateLimitConfig: RateLimitConfig = {
            maxRequestsPerMinute: vscodeConfig.get('maxRequestsPerMinute', 30),
            windowSizeMs: 60000,
            blockDurationMs: 300000
        };

        const validationConfig: CommandValidationConfig = {
            dangerousCommands: {
                unix: [
                    'rm', 'rmdir', 'dd', 'mkfs', 'fdisk',
                    'chmod', 'chown', 'su', 'sudo', 'passwd',
                    'mount', 'umount', 'killall', 'pkill',
                    'crontab', 'at', 'systemctl', 'service',
                    'iptables', 'ufw', 'firewall-cmd',
                    'userdel', 'usermod', 'groupdel'
                ],
                windows: [
                    'del', 'erase', 'rd', 'rmdir', 'format',
                    'diskpart', 'bcdedit', 'reg', 'regedit',
                    'sc', 'net', 'runas', 'takeown', 'icacls',
                    'schtasks', 'at', 'shutdown', 'restart',
                    'netsh', 'wmic', 'powershell', 'cmd'
                ],
                common: [
                    'curl', 'wget', 'bash', 'sh', 'zsh', 'fish',
                    'telnet', 'nc', 'netcat', 'nmap', 'nslookup',
                    'kill', 'killall', 'taskkill', 'exec',
                    'eval', 'source', 'alias'
                ]
            },
            developmentSafeCommands: vscodeConfig.get('additionalSafeCommands', []),
            dangerousPatterns: [
                /[;&|`$()]/,
                /\.\.\//,
                /\/etc\//,
                /\/var\//,
                /\/home\/.*\/\./,
                /C:\\Windows\\/,
                /C:\\System/,
                /\$\{.*\}/,
                /\$\(.*\)/,
                />\s*\/dev\//,
                />\s*NUL/,
                /\|\s*(sudo|su)\s/,
                /(&&|\|\|)\s*(sudo|su)\s/,
                /\bbase64\b.*-d/,
                /\b(chmod|chown)\s+[0-7]{3,4}/,
                /\bfind\s+\/.*-exec/,
                /\bxargs\b/,
                /\b(nc|netcat)\s+.*-e/,
            ],
            maxCommandLength: 500
        };

        return {
            strictMode: vscodeConfig.get('strictMode', true),
            enableRateLimit: true,
            enableCommandValidation: true,
            enableAuditLogging: vscodeConfig.get('auditLogging', true),
            allowedOrigins: ['vscode-file://', 'vscode-app://'],
            rateLimitConfig,
            validationConfig
        };
    }

    async start() {
        try {
            this.port = await this.findAvailablePort();
            
            this.server = http.createServer((req, res) => {
                this.handleSecureRequest(req, res);
            });

            this.server.listen(this.port, 'localhost', () => {
                // CORREGIDO: Usar output channel en lugar de console.log
                vscode.window.showInformationMessage(`Secure VSTR Bridge running on port ${this.port}`);
                this.registerSecureBridge();
                this.showSecurityNotification();
            });

            // Limpiar archivos antiguos al iniciar
            this.fileManager.cleanupStaleFiles();
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start secure bridge: ${error}`);
        }
    }

    private async findAvailablePort(): Promise<number> {
        return new Promise((resolve) => {
            const testServer = http.createServer();
            testServer.listen(0, 'localhost', () => {
                const address = testServer.address();
                const port = typeof address === 'object' ? address?.port || 0 : 0;
                testServer.close(() => resolve(port));
            });
        });
    }

    private registerSecureBridge() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const bridgeInfo = {
            port: this.port,
            pid: process.pid,
            instance_id: Date.now(),
            workspace_path: workspaceFolder?.uri.fsPath || '',
            workspace_name: workspaceFolder?.name || 'Unknown Workspace',
            timestamp: new Date().toISOString(),
            auth_token: this.securityMiddleware.getAuthToken(),
            secure: true
        };

        try {
            this.bridgeInfoPath = this.fileManager.writeBridgeInfo(bridgeInfo);
            this.context.environmentVariableCollection.replace('VSTR', this.port.toString());
            this.context.environmentVariableCollection.replace('VSTR_TOKEN', bridgeInfo.auth_token);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to register secure bridge: ${error}`);
        }
    }

    private handleSecureRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            // OPTIONS requests (preflight)
            if (req.method === 'OPTIONS') {
                this.securityMiddleware.handlePreflightRequest(req, res);
                return;
            }

            // Validación de seguridad
            if (!this.securityMiddleware.validateRequest(req, res)) {
                return; // Response ya enviada por el middleware
            }

            const url = new URL(req.url || '', `http://localhost:${this.port}`);
            
            switch (url.pathname) {
                case '/ping':
                    this.handlePing(res);
                    break;
                case '/task':
                    if (req.method === 'POST') {
                        this.handleSecureTask(req, res);
                    } else {
                        this.sendError(res, 405, 'Method not allowed');
                    }
                    break;
                case '/workspace':
                    if (req.method === 'POST') {
                        this.handleSecureWorkspace(req, res);
                    } else {
                        this.sendError(res, 405, 'Method not allowed');
                    }
                    break;
                case '/security/status':
                    if (req.method === 'GET') {
                        this.handleSecurityStatus(res);
                    } else {
                        this.sendError(res, 405, 'Method not allowed');
                    }
                    break;
                default:
                    this.sendError(res, 404, 'Not found');
            }
        } catch (error) {
            // CORREGIDO: Log de errores usando audit logger
            this.securityMiddleware.getAuditLogger().logSecurityEvent({
                type: 'suspicious_activity',
                details: `Request handling error: ${error}`,
                clientId: 'system',
                severity: 'high'
            });
            this.sendError(res, 500, 'Internal server error');
        }
    }

    private handlePing(res: http.ServerResponse) {
        const response = {
            status: 'ok',
            version: '0.1.2',
            workspace: vscode.workspace.name || 'Unknown',
            port: this.port,
            secure: true,
            security_features: ['authentication', 'rate_limiting', 'command_validation', 'audit_logging']
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
    }

    private async handleSecureTask(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const body = await this.parseBody<TaskConfig>(req);
            const clientId = this.securityMiddleware.getClientId(req);

            // Validar comandos si están presentes
            if (body.cmds && body.cmds.length > 0) {
                const command = body.cmds.join(' && ');
                if (!this.securityMiddleware.validateCommand(command, clientId)) {
                    this.sendError(res, 403, 'Command blocked by security policy');
                    return;
                }
            }

            const terminal = this.createTerminal(body);
            terminal.show();

            if (body.cmds && body.cmds.length > 0) {
                const command = body.cmds.join(' && ');
                terminal.sendText(command);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: `Secure terminal '${body.name}' created` 
            }));

        } catch (error) {
            this.sendError(res, 400, `Failed to create task: ${error}`);
        }
    }

    private async handleSecureWorkspace(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const body = await this.parseBody<WorkspaceConfig>(req);
            const clientId = this.securityMiddleware.getClientId(req);
            const results = [];

            for (const task of body.tasks) {
                try {
                    // Validar comandos para cada tarea
                    if (task.cmds && task.cmds.length > 0) {
                        const command = task.cmds.join(' && ');
                        if (!this.securityMiddleware.validateCommand(command, clientId)) {
                            results.push({ 
                                task: task.name, 
                                success: false, 
                                error: 'Command blocked by security policy' 
                            });
                            continue;
                        }
                    }

                    const terminal = this.createTerminal(task);
                    terminal.show();

                    if (task.cmds && task.cmds.length > 0) {
                        const command = task.cmds.join(' && ');
                        terminal.sendText(command);
                    }

                    results.push({ 
                        task: task.name, 
                        success: true 
                    });

                    await this.delay(100);

                } catch (error) {
                    results.push({ 
                        task: task.name, 
                        success: false, 
                        error: String(error) 
                    });
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                results 
            }));

        } catch (error) {
            this.sendError(res, 400, `Failed to create workspace: ${error}`);
        }
    }

    private handleSecurityStatus(res: http.ServerResponse) {
        const stats = this.securityMiddleware.getSecurityStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
    }

    private createTerminal(config: TaskConfig): vscode.Terminal {
        const terminalOptions: vscode.TerminalOptions = {
            name: config.name,
            cwd: config.path ? this.resolveTildePath(config.path) : undefined,
            iconPath: config.icon ? new vscode.ThemeIcon(config.icon) : undefined,
            color: this.parseTerminalColor(config.iconColor)
        };

        return vscode.window.createTerminal(terminalOptions);
    }

    private resolveTildePath(inputPath: string): string {
        if (!inputPath.startsWith('~')) {
            return inputPath;
        }

        const homeDir = os.homedir();

        if (inputPath === '~') {
            return homeDir;
        } else if (inputPath.startsWith('~/')) {
            return inputPath.replace('~', homeDir);
        }

        return inputPath;
    }

    private parseTerminalColor(color?: string): vscode.ThemeColor | undefined {
        if (!color) return undefined;

        const colorMap: Record<string, string> = {
            'terminal.ansiBlack': 'terminal.ansiBlack',
            'terminal.ansiRed': 'terminal.ansiRed',
            'terminal.ansiGreen': 'terminal.ansiGreen',
            'terminal.ansiYellow': 'terminal.ansiYellow',
            'terminal.ansiBlue': 'terminal.ansiBlue',
            'terminal.ansiMagenta': 'terminal.ansiMagenta',
            'terminal.ansiCyan': 'terminal.ansiCyan',
            'terminal.ansiWhite': 'terminal.ansiWhite',
            'terminal.ansiBrightBlack': 'terminal.ansiBrightBlack',
            'terminal.ansiBrightRed': 'terminal.ansiBrightRed',
            'terminal.ansiBrightGreen': 'terminal.ansiBrightGreen',
            'terminal.ansiBrightYellow': 'terminal.ansiBrightYellow',
            'terminal.ansiBrightBlue': 'terminal.ansiBrightBlue',
            'terminal.ansiBrightMagenta': 'terminal.ansiBrightMagenta',
            'terminal.ansiBrightCyan': 'terminal.ansiBrightCyan',
            'terminal.ansiBrightWhite': 'terminal.ansiBrightWhite'
        };

        const mappedColor = colorMap[color];
        return mappedColor ? new vscode.ThemeColor(mappedColor) : undefined;
    }

    private async parseBody<T>(req: http.IncomingMessage): Promise<T> {
        return new Promise((resolve, reject) => {
            let body = '';
            const maxBodySize = 1024 * 1024; // 1MB límite
            let receivedBytes = 0;

            req.on('data', chunk => {
                receivedBytes += chunk.length;
                if (receivedBytes > maxBodySize) {
                    reject(new Error('Request body too large'));
                    return;
                }
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('Invalid JSON'));
                }
            });

            req.on('error', reject);
        });
    }

    private sendError(res: http.ServerResponse, code: number, message: string) {
        res.writeHead(code, { 
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(JSON.stringify({ success: false, error: message }));
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private showSecurityNotification() {
        vscode.window.showInformationMessage(
            `🔒 Secure VSTR Bridge active on port ${this.port}`,
            'View Status', 'Security Settings'
        ).then(selection => {
            if (selection === 'View Status') {
                this.showStatus();
            } else if (selection === 'Security Settings') {
                this.showSecuritySettings();
            }
        });
    }

    showStatus() {
        const stats = this.securityMiddleware.getSecurityStats();
        const message = `Secure VSTR Bridge Status:
        • Port: ${this.port}
        • Workspace: ${vscode.workspace.name}
        • Security: ${stats.config.strictMode ? 'Strict Mode' : 'Permissive Mode'}
        • Blocked Clients: ${stats.blockedClients}
        • Safe Commands: ${stats.safeCommandsCount}
        • Audit Entries: ${stats.logStats.entries}`;

        vscode.window.showInformationMessage(message, 'View Logs', 'Security Config')
            .then(selection => {
                if (selection === 'View Logs') {
                    this.openAuditLogs();
                } else if (selection === 'Security Config') {
                    this.showSecuritySettings();
                }
            });
    }

    private openAuditLogs() {
        const auditLogger = this.securityMiddleware.getAuditLogger();
        try {
            vscode.workspace.openTextDocument(auditLogger.getLogPath()).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to open audit logs');
        }
    }

    private showSecuritySettings() {
        vscode.commands.executeCommand('workbench.action.openSettings', 'vstrBridge.security');
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }

        if (this.bridgeInfoPath) {
            this.fileManager.cleanupBridgeFile(this.bridgeInfoPath);
        }

        this.securityMiddleware.cleanup();
    }
}