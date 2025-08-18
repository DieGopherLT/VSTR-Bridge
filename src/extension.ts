import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

interface BridgeInfo {
    port: number;
    pid: number;
    instance_id: number;
    workspace_path: string;
    workspace_name: string;
    timestamp: string;
}

export function activate(context: vscode.ExtensionContext) {
    const bridgeServer = new BridgeServer(context);
    
    // Start server when extension activates
    bridgeServer.start();
    
    // Register disposal
    context.subscriptions.push({
        dispose: () => bridgeServer.stop()
    });
    
    // Register command to show bridge status
    context.subscriptions.push(
        vscode.commands.registerCommand('vscr-bridge.status', () => {
            bridgeServer.showStatus();
        })
    );
}

class BridgeServer {
    private server: http.Server | null = null;
    private port: number = 0;
    private context: vscode.ExtensionContext;
    private bridgeInfoPath: string = '';
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }
    
    async start() {
        // Find an available port
        this.port = await this.findAvailablePort();
        
        // Create HTTP server
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });
        
        // Start listening
        this.server.listen(this.port, 'localhost', () => {
            console.log(`VSCR Bridge running on port ${this.port}`);
            this.registerBridge();
            this.showNotification();
        });
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
    
    private registerBridge() {
        // Create bridge info
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const bridgeInfo: BridgeInfo = {
            port: this.port,
            pid: process.pid,
            instance_id: Date.now(),
            workspace_path: workspaceFolder?.uri.fsPath || '',
            workspace_name: workspaceFolder?.name || 'Unknown Workspace',
            timestamp: new Date().toISOString()
        };
        
        // Ensure directory exists
        const tmpDir = path.join(os.tmpdir(), 'vstr-bridge');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
        
        // Write bridge info file
        this.bridgeInfoPath = path.join(tmpDir, `bridge-${this.port}.json`);
        fs.writeFileSync(this.bridgeInfoPath, JSON.stringify(bridgeInfo, null, 2));
        
        // Set environment variable for integrated terminals
        this.context.environmentVariableCollection.replace('VSTR', this.port.toString());
    }
    
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new URL(req.url || '', `http://localhost:${this.port}`);
        
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        switch (url.pathname) {
            case '/ping':
                this.handlePing(res);
                break;
            case '/task':
                if (req.method === 'POST') {
                    this.handleTask(req, res);
                } else {
                    this.sendError(res, 405, 'Method not allowed');
                }
                break;
            case '/workspace':
                if (req.method === 'POST') {
                    this.handleWorkspace(req, res);
                } else {
                    this.sendError(res, 405, 'Method not allowed');
                }
                break;
            default:
                this.sendError(res, 404, 'Not found');
        }
    }
    
    private handlePing(res: http.ServerResponse) {
        const response = {
            status: 'ok',
            version: '1.0.0',
            workspace: vscode.workspace.name || 'Unknown',
            port: this.port
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
    }
    
    private async handleTask(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const body = await this.parseBody<TaskConfig>(req);
            
            // Create terminal with configuration
            const terminal = this.createTerminal(body);
            terminal.show();
            
            // Execute commands if provided
            if (body.cmds && body.cmds.length > 0) {
                const command = body.cmds.join(' && ');
                terminal.sendText(command);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: `Terminal '${body.name}' created` 
            }));
            
        } catch (error) {
            this.sendError(res, 400, `Failed to create task: ${error}`);
        }
    }
    
    private async handleWorkspace(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const body = await this.parseBody<WorkspaceConfig>(req);
            
            // Create terminals for all tasks
            const results = [];
            for (const task of body.tasks) {
                try {
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
                    
                    // Small delay between terminals
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
    
    private createTerminal(config: TaskConfig): vscode.Terminal {
        const terminalOptions: vscode.TerminalOptions = {
            name: config.name,
            cwd: config.path || undefined,
            iconPath: config.icon ? new vscode.ThemeIcon(config.icon) : undefined,
            color: this.parseTerminalColor(config.iconColor)
        };
        
        return vscode.window.createTerminal(terminalOptions);
    }
    
    private parseTerminalColor(color?: string): vscode.ThemeColor | undefined {
        if (!color) return undefined;
        
        // Map ANSI color names to VSCode theme colors
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
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
    
    private sendError(res: http.ServerResponse, code: number, message: string) {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: message }));
    }
    
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    private showNotification() {
        vscode.window.showInformationMessage(
            `VSCR Bridge active on port ${this.port}`,
            'View Status'
        ).then(selection => {
            if (selection === 'View Status') {
                this.showStatus();
            }
        });
    }
    
    showStatus() {
        const message = `VSCR Bridge Status:
        • Port: ${this.port}
        • Workspace: ${vscode.workspace.name}
        • Path: ${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath}`;
        
        vscode.window.showInformationMessage(message);
    }
    
    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        
        // Clean up bridge info file
        if (this.bridgeInfoPath && fs.existsSync(this.bridgeInfoPath)) {
            fs.unlinkSync(this.bridgeInfoPath);
        }
    }
}

export function deactivate() {
    // Cleanup handled by disposal
}