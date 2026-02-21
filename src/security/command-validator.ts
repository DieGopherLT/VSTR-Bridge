import { ValidationResult, CommandValidationConfig } from './types';

export class CommandValidator {
  private config: CommandValidationConfig;
  private platform: string;

  constructor(config?: Partial<CommandValidationConfig>, platform: string = process.platform) {
    this.platform = platform;
    this.config = {
      developmentSafeCommands: [], // Lista vacía por defecto, se poblará dinámicamente
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
      ...config,
    };
  }

  public validateCommand(cmd: string): ValidationResult {
    const platform = this.detectPlatform();
    const result: ValidationResult = {
      isValid: true,
      reason: '',
      sanitizedCommand: cmd.trim(),
    };

    if (!cmd || cmd.trim() === '') {
      result.isValid = false;
      result.reason = 'Empty command not allowed';
      return result;
    }

    const sanitizedCmd = cmd.trim();
    const firstWord = sanitizedCmd.split(' ')[0].toLowerCase();

    // Fast path: Comandos previamente aprobados por el usuario
    if (this.config.developmentSafeCommands.includes(firstWord)) {
      result.sanitizedCommand = sanitizedCmd;
      return result;
    }

    // Validar longitud
    if (sanitizedCmd.length > this.config.maxCommandLength) {
      result.isValid = false;
      result.reason = `Command exceeds maximum length of ${this.config.maxCommandLength} characters`;
      return result;
    }

    // Validar patrones peligrosos
    for (const pattern of this.config.dangerousPatterns) {
      if (pattern.test(sanitizedCmd)) {
        result.isValid = false;
        result.reason = `Dangerous pattern detected: potentially malicious command structure`;
        return result;
      }
    }

    // Validar comandos específicos de plataforma
    const dangerousCmds = [...this.config.dangerousCommands.common, ...this.config.dangerousCommands[platform]];

    if (dangerousCmds.includes(firstWord)) {
      result.isValid = false;
      result.reason = `Dangerous command detected: '${firstWord}' is not allowed for security reasons`;
      return result;
    }

    // Validaciones adicionales para comandos no en blacklist
    if (this.containsSuspiciousContent(sanitizedCmd)) {
      result.isValid = false;
      result.reason = 'Command contains suspicious content';
      return result;
    }

    // Si llegamos aquí, el comando no está en blacklist ni tiene patrones peligrosos
    // Se permite el comando (principio de menor fricción)
    result.sanitizedCommand = sanitizedCmd;
    return result;
  }

  private containsSuspiciousContent(cmd: string): boolean {
    // CORREGIDO: Detectar CUALQUIER redirection (más estricto)
    if (/[<>]/.test(cmd)) {
      return true;
    }

    // CORREGIDO: Detectar escape de comillas
    if (/\\['"`]|['"`].*['"`]/.test(cmd)) {
      return true;
    }

    // CORREGIDO: Límites más restrictivos para cadenas
    if (cmd.split('&&').length > 2 || cmd.split('||').length > 1) {
      return true;
    }

    // CORREGIDO: Detectar intentos de ejecución anidada
    if (/\$\(|\`|\$\{/.test(cmd)) {
      return true;
    }

    // CORREGIDO: Detectar URLs o descargas
    if (/https?:\/\/|ftp:\/\//.test(cmd)) {
      return true;
    }

    // Detectar intentos de encode/decode
    if (/\b(base64|uuencode|xxd)\b/.test(cmd)) {
      return true;
    }

    return false;
  }

  private detectPlatform(): 'unix' | 'windows' {
    return this.platform === 'win32' ? 'windows' : 'unix';
  }

  public addSafeCommand(command: string): void {
    if (!this.config.developmentSafeCommands.includes(command)) {
      this.config.developmentSafeCommands.push(command);
    }
  }

  public removeSafeCommand(command: string): void {
    const index = this.config.developmentSafeCommands.indexOf(command);
    if (index > -1) {
      this.config.developmentSafeCommands.splice(index, 1);
    }
  }

  public getSafeCommands(): string[] {
    return [...this.config.developmentSafeCommands];
  }
}
