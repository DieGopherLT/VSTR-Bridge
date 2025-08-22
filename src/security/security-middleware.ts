import * as http from 'http';
import { AuthManager } from './auth-manager';
import { CommandValidator } from './command-validator';
import { RateLimiter } from './rate-limiter';
import { CorsManager } from './cors-manager';
import { AuditLogger } from './audit-logger';
import { SecurityConfig } from './types';

export class SecurityMiddleware {
    private authManager: AuthManager;
    private commandValidator: CommandValidator;
    private rateLimiter: RateLimiter;
    private corsManager: CorsManager;
    private auditLogger: AuditLogger;
    private config: SecurityConfig;

    constructor(config: SecurityConfig, bridgeDir: string) {
        this.config = config;
        this.authManager = new AuthManager();
        this.commandValidator = new CommandValidator(config.validationConfig);
        this.rateLimiter = new RateLimiter(config.rateLimitConfig);
        this.corsManager = new CorsManager(config.allowedOrigins);
        this.auditLogger = new AuditLogger(bridgeDir);

        // Limpiar datos antiguos cada 5 minutos
        setInterval(() => {
            this.rateLimiter.cleanup();
        }, 5 * 60 * 1000);
    }

    public validateRequest(req: http.IncomingMessage, res: http.ServerResponse): boolean {
        const clientId = this.rateLimiter.getClientId(req);

        // 1. Validar CORS
        if (!this.corsManager.validateOrigin(req)) {
            this.auditLogger.logSuspiciousActivity(
                `Invalid origin: ${req.headers.origin}`,
                clientId
            );
            this.sendSecurityError(res, 403, 'Origin not allowed');
            return false;
        }

        // 2. Rate limiting
        if (this.config.enableRateLimit && !this.rateLimiter.checkRateLimit(clientId)) {
            this.auditLogger.logRateLimitExceeded(clientId);
            this.sendSecurityError(res, 429, 'Rate limit exceeded');
            return false;
        }

        // 3. Autenticación (skip para OPTIONS)
        if (req.method !== 'OPTIONS') {
            const authHeader = req.headers.authorization;
            const token = this.authManager.extractTokenFromRequest(authHeader);
            
            if (!token || !this.authManager.validateToken(token)) {
                this.auditLogger.logAuthFailure(
                    clientId,
                    token ? 'Invalid token' : 'Missing token'
                );
                this.sendSecurityError(res, 401, 'Authentication required');
                return false;
            }
        }

        // Establecer headers CORS
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
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(JSON.stringify({ 
            success: false, 
            error: message,
            code: code
        }));
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
            severity: 'medium'
        });
        return newToken;
    }

    public addSafeCommand(command: string): void {
        this.commandValidator.addSafeCommand(command);
        this.auditLogger.logSecurityEvent({
            type: 'suspicious_activity',
            details: `Safe command added: ${command}`,
            clientId: 'system',
            severity: 'low'
        });
    }

    public removeSafeCommand(command: string): void {
        this.commandValidator.removeSafeCommand(command);
        this.auditLogger.logSecurityEvent({
            type: 'suspicious_activity',
            details: `Safe command removed: ${command}`,
            clientId: 'system',
            severity: 'low'
        });
    }

    public getSafeCommands(): string[] {
        return this.commandValidator.getSafeCommands();
    }

    public getBlockedClients(): string[] {
        return this.rateLimiter.getBlockedClients();
    }

    public unblockClient(clientId: string): boolean {
        const success = this.rateLimiter.unblockClient(clientId);
        if (success) {
            this.auditLogger.logSecurityEvent({
                type: 'suspicious_activity',
                details: `Client unblocked: ${clientId}`,
                clientId: 'system',
                severity: 'low'
            });
        }
        return success;
    }

    public getSecurityStats(): any {
        return {
            blockedClients: this.rateLimiter.getBlockedClients().length,
            allowedOrigins: this.corsManager.getAllowedOrigins(),
            safeCommandsCount: this.commandValidator.getSafeCommands().length,
            logStats: this.auditLogger.getLogStats(),
            config: {
                strictMode: this.config.strictMode,
                rateLimit: this.config.enableRateLimit,
                commandValidation: this.config.enableCommandValidation,
                auditLogging: this.config.enableAuditLogging
            }
        };
    }

    public updateConfig(newConfig: Partial<SecurityConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        this.auditLogger.logSecurityEvent({
            type: 'suspicious_activity',
            details: `Security configuration updated`,
            clientId: 'system',
            severity: 'medium'
        });
    }

    public getAuditLogger(): AuditLogger {
        return this.auditLogger;
    }

    public getClientId(req: http.IncomingMessage): string {
        return this.rateLimiter.getClientId(req);
    }

    public cleanup(): void {
        this.rateLimiter.cleanup();
    }
}