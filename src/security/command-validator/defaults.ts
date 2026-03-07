import { CommandValidationConfig } from '../types';

export const DEFAULT_VALIDATION_CONFIG: CommandValidationConfig = {
  developmentSafeCommands: [],
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
  dangerousPatterns: [
    /[;&|`$()]/, // Shell injection
    /\.\.\//, // Directory traversal
    /\/etc\//, // System directories
    /\/var\//,
    /\/home\/.*\/\./, // Hidden files
    /C:\\Windows\\/, // Windows system
    /C:\\System/,
    /\$\{.*\}/, // Variable expansion
    /\$\(.*\)/, // Command substitution
    />\s*\/dev\//, // Device access
    />\s*NUL/, // Windows null device
    /\|\s*(sudo|su)\s/, // Privilege escalation
    /(&&|\|\|)\s*(sudo|su)\s/, // Chained privilege escalation
    /\bbase64\b.*-d/, // Base64 decode (potential payload)
    /\b(chmod|chown)\s+[0-7]{3,4}/, // Permission changes
    /\bfind\s+\/.*-exec/, // Find with exec
    /\bxargs\b/, // xargs command
    /\b(nc|netcat)\s+.*-e/, // Netcat with execute
  ],
  maxCommandLength: 500,
};
