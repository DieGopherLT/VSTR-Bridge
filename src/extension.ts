import * as vscode from 'vscode';
import { SecureBridgeServer } from './secure-bridge-server';

export function activate(context: vscode.ExtensionContext) {
    const bridgeServer = new SecureBridgeServer(context);
    
    // Start secure server when extension activates
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

export function deactivate() {
    // Cleanup handled by disposal
}