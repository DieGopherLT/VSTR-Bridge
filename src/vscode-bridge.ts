import * as vscode from 'vscode';
import * as http from 'http';
import { DatabaseManager } from './database/connection';
import { InstancePublisher } from './database/instances';
import { CredentialsPublisher } from './database/credentials';
import { CryptoManager } from './cipher/crypto';
import { deriveSystemKey } from './cipher/keyDerivation';
import {
    SecurityMiddleware,
    SecureFileManager,
    SecurityConfig,
    CommandValidationConfig,
    RateLimitConfig
} from './security';
import { DANGEROUS_COMMANDS, DANGEROUS_PATTERNS } from './security/security-constants';
import { findAvailablePort } from './utils/port-utils';

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

export class VSCodeBridge {
    private server: http.Server | null = null;
    private context: vscode.ExtensionContext;
    private databaseManager: DatabaseManager;
    private instancePublisher: InstancePublisher;
    private credentialsPublisher: CredentialsPublisher;
    private cryptoManager: CryptoManager;
    private securityMiddleware: SecurityMiddleware;
    private fileManager: SecureFileManager;
    private config: SecurityConfig;
    private instanceId: number = 0;

    constructor(
        private port: number,
        context: vscode.ExtensionContext
    ) {
        this.context = context;
        this.databaseManager = new DatabaseManager();
        this.fileManager = new SecureFileManager();
        this.config = this.loadSecurityConfig();
 
        const systemKey = deriveSystemKey();
        this.cryptoManager = new CryptoManager(systemKey);
       
        this.instancePublisher = new InstancePublisher(this.databaseManager);
        this.credentialsPublisher = new CredentialsPublisher(this.databaseManager, this.cryptoManager);
        
        this.securityMiddleware = new SecurityMiddleware(
            this.config,
            this.fileManager.getBridgeDirectory()
        );
    }

    async start(): Promise<void> {
        await this.databaseManager.initialize();
        
        this.instanceId = await this.instancePublisher.registerInstance(
            this.port,
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            vscode.workspace.name || 'Untitled'
        );
        
        await this.credentialsPublisher.initializeCredentialPool(this.instanceId, 3);
        
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res).catch(error => {
                console.error('Error handling request:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            });
        });

        const availablePort = await findAvailablePort();
        this.port = availablePort;
        
        await this.instancePublisher.registerInstance(
            this.port,
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            vscode.workspace.name || 'Untitled'
        );
        
        this.server.listen(this.port, 'localhost', () => {
            const config = vscode.workspace.getConfiguration('vstrBridge');
            const silentMode = config.get('silentMode', false);
            
            if (!silentMode) {
                vscode.window.showInformationMessage(
                    'VSTR Bridge initialized successfully', 
                    'Silence notifications'
                ).then(selection => {
                    if (selection === 'Silence notifications') {
                        config.update('silentMode', true, vscode.ConfigurationTarget.Global);
                    }
                });
            }
        });
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (!this.securityMiddleware.validateRequest(req, res)) {
            return;
        }

        const url = new URL(req.url!, `http://localhost:${this.port}`);

        switch (url.pathname) {
            case '/ping':
                await this.handlePing(req, res);
                break;
            case '/task':
                await this.handleTask(req, res);
                break;
            case '/workspace':
                await this.handleWorkspace(req, res);
                break;
            case '/security/status':
                await this.handleSecurityStatus(req, res);
                break;
            default:
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
        }

        const remainingCredentials = await this.credentialsPublisher.getCredentialCount(this.instanceId);
        if (remainingCredentials < 3) {
            this.credentialsPublisher.scheduleCredentialRefill(this.instanceId, 5);
        }
    }

    private async handlePing(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            timestamp: Date.now(),
            instanceId: this.instanceId,
            availableCredentials: await this.credentialsPublisher.getCredentialCount(this.instanceId)
        }));
    }

    private async handleTask(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        try {
            const body = await this.parseBody<TaskConfig>(req);
            
            if (!body.name || !body.cmds || !Array.isArray(body.cmds)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid task configuration' }));
                return;
            }

            const terminal = this.createTerminal(body);
            
            const workingDirectory = this.resolveWorkingDirectory(body.path);
            if (workingDirectory !== process.cwd()) {
                terminal.sendText(`cd "${workingDirectory}"`);
            }

            for (const cmd of body.cmds) {
                const clientId = this.securityMiddleware.getClientId(req);
                if (!this.securityMiddleware.validateCommand(cmd, clientId)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Command validation failed' }));
                    return;
                }
                terminal.sendText(cmd);
            }

            terminal.show();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Task executed successfully',
                terminal: body.name
            }));

        } catch (error) {
            console.error('Task execution error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Task execution failed' }));
        }
    }

    private async handleWorkspace(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        try {
            const body = await this.parseBody<WorkspaceConfig>(req);
            
            if (!body.name || !body.tasks || !Array.isArray(body.tasks)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid workspace configuration' }));
                return;
            }

            const results: any[] = [];
            
            for (const task of body.tasks) {
                try {
                    const terminal = this.createTerminal(task);
                    
                    const workingDirectory = this.resolveWorkingDirectory(task.path);
                    if (workingDirectory !== process.cwd()) {
                        terminal.sendText(`cd "${workingDirectory}"`);
                    }

                    for (const cmd of task.cmds) {
                        const clientId = this.securityMiddleware.getClientId(req);
                        if (!this.securityMiddleware.validateCommand(cmd, clientId)) {
                            results.push({
                                name: task.name,
                                success: false,
                                error: 'Command validation failed'
                            });
                            continue;
                        }
                        terminal.sendText(cmd);
                    }

                    results.push({
                        name: task.name,
                        success: true,
                        message: 'Task queued successfully'
                    });

                } catch (error) {
                    results.push({
                        name: task.name,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true,
                workspace: body.name,
                results 
            }));

        } catch (error) {
            console.error('Workspace execution error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Workspace execution failed' }));
        }
    }

    private async handleSecurityStatus(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const stats = this.securityMiddleware.getSecurityStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
    }

    private createTerminal(task: TaskConfig): vscode.Terminal {
        const options: vscode.TerminalOptions = {
            name: task.name,
            iconPath: task.icon ? new vscode.ThemeIcon(task.icon) : new vscode.ThemeIcon('terminal'),
            color: this.parseTerminalColor(task.iconColor)
        };

        return vscode.window.createTerminal(options);
    }

    private parseTerminalColor(color?: string): vscode.ThemeColor | undefined {
        return color ? new vscode.ThemeColor(color) : undefined;
    }

    private resolveWorkingDirectory(path: string): string {
        if (!path) {
            return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        }

        if (path.startsWith('~/')) {
            const os = require('os');
            return path.replace('~', os.homedir());
        }

        return path;
    }

    private async parseBody<T>(req: http.IncomingMessage): Promise<T> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('Invalid JSON'));
                }
            });
        });
    }


    private loadSecurityConfig(): SecurityConfig {
        const vscodeConfig = vscode.workspace.getConfiguration('vstrBridge.security');
        
        const rateLimitConfig: RateLimitConfig = {
            maxRequestsPerMinute: vscodeConfig.get('maxRequestsPerMinute', 30),
            windowSizeMs: 60000,
            blockDurationMs: 300000
        };

        const validationConfig: CommandValidationConfig = {
            dangerousCommands: DANGEROUS_COMMANDS,
            developmentSafeCommands: vscodeConfig.get('additionalSafeCommands', []),
            dangerousPatterns: DANGEROUS_PATTERNS,
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

    async stop(): Promise<void> {
        if (this.server) {
            this.server.close();
            this.server = null;
        }

        this.credentialsPublisher.cleanup();
        
        if (this.instanceId) {
            await this.instancePublisher.cleanupInstance(this.instanceId);
        }

        await this.databaseManager.close();
    }

    showStatus(): void {
        const stats = this.securityMiddleware.getSecurityStats();
        const message = `VSTR Bridge Status:
• Status: Active
• Port: ${this.port}
• Instance ID: ${this.instanceId}
• Workspace: ${vscode.workspace.name || 'Untitled'}
• Database: ${this.databaseManager.getDatabasePath()}
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

    private openAuditLogs(): void {
        const auditLogger = this.securityMiddleware.getAuditLogger();
        try {
            vscode.workspace.openTextDocument(auditLogger.getLogPath()).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to open audit logs');
        }
    }

    private showSecuritySettings(): void {
        vscode.commands.executeCommand('workbench.action.openSettings', 'vstrBridge.security');
    }
}