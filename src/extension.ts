import * as vscode from 'vscode';
import { VSCodeBridge } from './vscode-bridge';

export async function activate(context: vscode.ExtensionContext) {
    try {
        const net = require('net');

        console.log('Activating VSTR Bridge extension');
        
        const port = await new Promise<number>((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on('error', reject);
            server.listen(0, () => {
                const port = server.address()?.port;
                server.close(() => {
                    resolve(port);
                });
            });
        });

        console.log('About to start VSCodeBridge on port:', port);
        const bridge = new VSCodeBridge(port, context);
        await bridge.start();
        
        context.subscriptions.push({
            dispose: () => bridge.stop()
        });
        
        context.subscriptions.push(
            vscode.commands.registerCommand('vscr-bridge.status', () => {
                bridge.showStatus();
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(async () => {
                await bridge.stop();
            })
        );

    } catch (error) {
        console.error('Failed to activate VSTR Bridge:', error);
        vscode.window.showErrorMessage('Failed to start VSTR Bridge: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

export function deactivate() {
    // Cleanup handled by disposal
}