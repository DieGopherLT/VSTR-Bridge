import * as http from 'http';
import { AuthManager } from '../auth-manager';
import { CommandValidator } from '../command-validator';
import { RateLimiter } from '../rate-limiter';
import { CorsManager } from '../cors-manager';
import { AuditLogger } from '../audit-logger';
import { SecurityConfig, SecurityStats } from '../types';

export interface SecurityMiddlewareDependencies {
  authManager: AuthManager;
  commandValidator: CommandValidator;
  rateLimiter: RateLimiter;
  corsManager: CorsManager;
  auditLogger: AuditLogger;
}

export class SecurityMiddleware {
  private authManager: AuthManager;
  private commandValidator: CommandValidator;
  private rateLimiter: RateLimiter;
  private corsManager: CorsManager;
  private auditLogger: AuditLogger;
  private config: SecurityConfig;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(config: SecurityConfig, bridgeDir: string, dependencies?: Partial<SecurityMiddlewareDependencies>) {
    this.config = config;
    this.authManager = dependencies?.authManager ?? new AuthManager();
    this.commandValidator = dependencies?.commandValidator ?? new CommandValidator(config.validationConfig);
    this.rateLimiter = dependencies?.rateLimiter ?? new RateLimiter(config.rateLimitConfig);
    this.corsManager = dependencies?.corsManager ?? new CorsManager(config.allowedOrigins);
    this.auditLogger = dependencies?.auditLogger ?? new AuditLogger({ bridgeDir });

    this.cleanupInterval = setInterval(
      () => {
        this.rateLimiter.cleanup();
      },
      5 * 60 * 1000
    );
  }

  public validateRequest(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const clientId = this.rateLimiter.getClientId(req);

    if (!this.corsManager.validateOrigin(req)) {
      this.auditLogger.logSuspiciousActivity(`Invalid origin: ${req.headers.origin}`, clientId);
      this.sendSecurityError(res, 403, 'Origin not allowed');
      return false;
    }

    if (this.config.enableRateLimit && !this.rateLimiter.checkRateLimit(clientId)) {
      this.auditLogger.logRateLimitExceeded(clientId);
      this.sendSecurityError(res, 429, 'Rate limit exceeded');
      return false;
    }

    if (req.method !== 'OPTIONS') {
      const authHeader = req.headers.authorization;
      const token = this.authManager.extractTokenFromRequest(authHeader);

      if (!token || !this.authManager.validateToken(token)) {
        this.auditLogger.logAuthFailure(clientId, token ? 'Invalid token' : 'Missing token');
        this.sendSecurityError(res, 401, 'Authentication required');
        return false;
      }
    }

    this.corsManager.setCorsHeaders(res, req);

    return true;
  }

  public validateCommand(command: string, clientId: string): boolean {
    if (!this.config.enableCommandValidation) {
      return true;
    }

    const result = this.commandValidator.validateCommand(command);

    if (!result.isValid) {
      this.auditLogger.logCommandBlocked(command, result.reason, clientId);
      return false;
    }

    return true;
  }

  public handlePreflightRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.corsManager.handlePreflightRequest(res, req);
  }

  private sendSecurityError(res: http.ServerResponse, code: number, message: string): void {
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(
      JSON.stringify({
        success: false,
        error: message,
        code: code,
      })
    );
  }

  public getAuthToken(): string {
    return this.authManager.getToken();
  }

  public regenerateAuthToken(): string {
    const newToken = this.authManager.regenerateToken();
    this.auditLogger.logSecurityEvent({
      type: 'suspicious_activity',
      details: 'Auth token regenerated',
      clientId: 'system',
      severity: 'medium',
    });
    return newToken;
  }

  public addSafeCommand(command: string): void {
    this.commandValidator.addSafeCommand(command);
    this.auditLogger.logSecurityEvent({
      type: 'suspicious_activity',
      details: `Safe command added: ${command}`,
      clientId: 'system',
      severity: 'low',
    });
  }

  public removeSafeCommand(command: string): void {
    this.commandValidator.removeSafeCommand(command);
    this.auditLogger.logSecurityEvent({
      type: 'suspicious_activity',
      details: `Safe command removed: ${command}`,
      clientId: 'system',
      severity: 'low',
    });
  }

  public getSafeCommands(): string[] {
    return this.commandValidator.getSafeCommands();
  }

  public getBlockedClients(): string[] {
    return this.rateLimiter.getBlockedClients();
  }

  public unblockClient(clientId: string): boolean {
    const isSuccessful = this.rateLimiter.unblockClient(clientId);
    if (isSuccessful) {
      this.auditLogger.logSecurityEvent({
        type: 'suspicious_activity',
        details: `Client unblocked: ${clientId}`,
        clientId: 'system',
        severity: 'low',
      });
    }
    return isSuccessful;
  }

  public getSecurityStats(): SecurityStats {
    return {
      blockedClients: this.rateLimiter.getBlockedClients().length,
      allowedOrigins: this.corsManager.getAllowedOrigins(),
      safeCommandsCount: this.commandValidator.getSafeCommands().length,
      logStats: this.auditLogger.getLogStats(),
      config: {
        strictMode: this.config.strictMode,
        rateLimit: this.config.enableRateLimit,
        commandValidation: this.config.enableCommandValidation,
        auditLogging: this.config.enableAuditLogging,
      },
    };
  }

  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };

    this.auditLogger.logSecurityEvent({
      type: 'suspicious_activity',
      details: 'Security configuration updated',
      clientId: 'system',
      severity: 'medium',
    });
  }

  public getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  public getClientId(req: http.IncomingMessage): string {
    return this.rateLimiter.getClientId(req);
  }

  public cleanup(): void {
    clearInterval(this.cleanupInterval);
    this.rateLimiter.cleanup();
  }
}
