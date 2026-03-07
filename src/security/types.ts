export interface ValidationResult {
  isValid: boolean;
  reason: string;
  sanitizedCommand?: string;
}

export interface SecurityEvent {
  type: 'auth_failure' | 'command_blocked' | 'rate_limit_exceeded' | 'suspicious_activity';
  details: string;
  clientId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: string;
}

export interface CommandValidationConfig {
  dangerousCommands: {
    unix: string[];
    windows: string[];
    common: string[];
  };
  developmentSafeCommands: string[];
  dangerousPatterns: RegExp[];
  maxCommandLength: number;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  windowSizeMs: number;
  blockDurationMs: number;
}

export interface SecurityConfig {
  strictMode: boolean;
  enableRateLimit: boolean;
  enableCommandValidation: boolean;
  enableAuditLogging: boolean;
  allowedOrigins: string[];
  rateLimitConfig: RateLimitConfig;
  validationConfig: CommandValidationConfig;
}

export interface SecurityStats {
  blockedClients: number;
  allowedOrigins: string[];
  safeCommandsCount: number;
  logStats: { size: number; entries: number };
  config: {
    strictMode: boolean;
    rateLimit: boolean;
    commandValidation: boolean;
    auditLogging: boolean;
  };
}
