import * as vscode from 'vscode';
import { SecureBridgeServer, VSCodeAdapter } from './secure-bridge-server';
import { SecurityConfig, CommandValidationConfig, RateLimitConfig } from './security';

function buildSecurityConfig(): SecurityConfig {
  const vscodeConfig = vscode.workspace.getConfiguration('vstrBridge.security');

  const rateLimitConfig: RateLimitConfig = {
    maxRequestsPerMinute: vscodeConfig.get('maxRequestsPerMinute', 30),
    windowSizeMs: 60000,
    blockDurationMs: 300000,
  };

  const validationConfig: CommandValidationConfig = {
    dangerousCommands: {
      unix: [
        'rm',
        'rmdir',
        'dd',
        'mkfs',
        'fdisk',
        'chmod',
        'chown',
        'su',
        'sudo',
        'passwd',
        'mount',
        'umount',
        'killall',
        'pkill',
        'crontab',
        'at',
        'systemctl',
        'service',
        'iptables',
        'ufw',
        'firewall-cmd',
        'userdel',
        'usermod',
        'groupdel',
      ],
      windows: [
        'del',
        'erase',
        'rd',
        'rmdir',
        'format',
        'diskpart',
        'bcdedit',
        'reg',
        'regedit',
        'sc',
        'net',
        'runas',
        'takeown',
        'icacls',
        'schtasks',
        'at',
        'shutdown',
        'restart',
        'netsh',
        'wmic',
        'powershell',
        'cmd',
      ],
      common: [
        'curl',
        'wget',
        'bash',
        'sh',
        'zsh',
        'fish',
        'telnet',
        'nc',
        'netcat',
        'nmap',
        'nslookup',
        'kill',
        'killall',
        'taskkill',
        'exec',
        'eval',
        'source',
        'alias',
      ],
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
    maxCommandLength: 500,
  };

  return {
    strictMode: vscodeConfig.get('strictMode', true),
    enableRateLimit: true,
    enableCommandValidation: true,
    enableAuditLogging: vscodeConfig.get('auditLogging', true),
    allowedOrigins: ['vscode-file://', 'vscode-app://'],
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
