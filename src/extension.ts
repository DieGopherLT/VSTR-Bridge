import * as vscode from 'vscode';
import { SecureBridgeServer, VSCodeAdapter } from './secure-bridge-server';
import { SecurityConfig, RateLimitConfig } from './security';
import { DEFAULT_VALIDATION_CONFIG } from './security/command-validator/defaults';
import { VSCODE_ALLOWED_ORIGINS } from './security/cors-manager';
import { DEFAULT_RATE_LIMIT_CONFIG } from './security/rate-limiter/defaults';

function buildSecurityConfig(): SecurityConfig {
  const vscodeConfig = vscode.workspace.getConfiguration('vstrBridge.security');

  const rateLimitConfig: RateLimitConfig = {
    ...DEFAULT_RATE_LIMIT_CONFIG,
    maxRequestsPerMinute: vscodeConfig.get('maxRequestsPerMinute', DEFAULT_RATE_LIMIT_CONFIG.maxRequestsPerMinute),
  };

  const validationConfig = {
    ...DEFAULT_VALIDATION_CONFIG,
    developmentSafeCommands: vscodeConfig.get('additionalSafeCommands', []),
  };

  return {
    strictMode: vscodeConfig.get('strictMode', true),
    enableRateLimit: true,
    enableCommandValidation: true,
    enableAuditLogging: vscodeConfig.get('auditLogging', true),
    allowedOrigins: [...VSCODE_ALLOWED_ORIGINS],
    rateLimitConfig,
    validationConfig,
  };
}

function buildVSCodeAdapter(context: vscode.ExtensionContext): VSCodeAdapter {
  return {
    showInformationMessage: (message, ...actions) => vscode.window.showInformationMessage(message, ...actions),
    showErrorMessage: (message, ...actions) => vscode.window.showErrorMessage(message, ...actions),
    showWarningMessage: (message) => vscode.window.showWarningMessage(message),
    getWorkspaceName: () => vscode.workspace.name,
    getWorkspaceFolders: () => vscode.workspace.workspaceFolders,
    getConfiguration: (section) => vscode.workspace.getConfiguration(section),
    createTerminal: (options) => vscode.window.createTerminal(options),
    openTextDocument: (path) => vscode.workspace.openTextDocument(path),
    showTextDocument: (doc) => {
      vscode.window.showTextDocument(doc);
    },
    executeCommand: (command, ...args) => {
      vscode.commands.executeCommand(command, ...args);
    },
    setEnvironmentVariable: (name, value) => {
      context.environmentVariableCollection.replace(name, value);
    },
  };
}

export function activate(context: vscode.ExtensionContext) {
  const vsCodeAdapter = buildVSCodeAdapter(context);
  const securityConfig = buildSecurityConfig();
  const bridgeServer = new SecureBridgeServer(vsCodeAdapter, securityConfig);

  bridgeServer.start();

  context.subscriptions.push({
    dispose: () => bridgeServer.stop(),
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('vscr-bridge.status', () => {
      bridgeServer.showStatus();
    })
  );
}

export function deactivate() {
  // Cleanup handled by disposal
}
