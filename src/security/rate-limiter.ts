import * as http from 'http';
import * as crypto from 'crypto';
import { RateLimitConfig } from './types';

export class RateLimiter {
    private requestCounts = new Map<string, number[]>();
    private blockedClients = new Map<string, number>();
    private config: RateLimitConfig;

    constructor(config?: Partial<RateLimitConfig>) {
        this.config = {
            maxRequestsPerMinute: 30,
            windowSizeMs: 60000, // 1 minuto
            blockDurationMs: 300000, // 5 minutos
            ...config
        };
    }

    public checkRateLimit(clientId: string): boolean {
        const now = Date.now();

        // Verificar si el cliente está bloqueado
        if (this.isClientBlocked(clientId, now)) {
            return false;
        }

        // Inicializar si es la primera vez
        if (!this.requestCounts.has(clientId)) {
            this.requestCounts.set(clientId, []);
        }

        const requests = this.requestCounts.get(clientId)!;
        
        // Limpiar requests antiguos fuera de la ventana
        const windowStart = now - this.config.windowSizeMs;
        const recentRequests = requests.filter(time => time > windowStart);
        this.requestCounts.set(clientId, recentRequests);

        // Verificar límite
        if (recentRequests.length >= this.config.maxRequestsPerMinute) {
            // Bloquear cliente por exceder el límite
            this.blockedClients.set(clientId, now + this.config.blockDurationMs);
            return false;
        }

        // Registrar request actual
        recentRequests.push(now);
        return true;
    }

    public getClientId(req: http.IncomingMessage): string {
        const ip = this.getClientIP(req);
        const userAgent = req.headers['user-agent'] || 'unknown';
        const acceptLang = req.headers['accept-language'] || '';
        
        // CORREGIDO: Crear fingerprint criptográficamente seguro
        return this.createSecureFingerprint(ip, userAgent, acceptLang);
    }

    private getClientIP(req: http.IncomingMessage): string {
        // Intentar obtener IP real considerando proxies
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded && typeof forwarded === 'string') {
            return forwarded.split(',')[0].trim();
        }

        const realIP = req.headers['x-real-ip'];
        if (realIP && typeof realIP === 'string') {
            return realIP;
        }

        return req.socket.remoteAddress || 'unknown';
    }

    private createSecureFingerprint(ip: string, userAgent: string, acceptLang: string): string {
        // CORREGIDO: Usar hash criptográfico para evitar colisiones intencionales
        const fingerprint = `${ip}:${userAgent}:${acceptLang}`;
        return crypto.createHash('sha256')
            .update(fingerprint)
            .digest('hex')
            .substring(0, 16); // Suficiente para identificación única
    }

    private isClientBlocked(clientId: string, now: number): boolean {
        const blockUntil = this.blockedClients.get(clientId);
        if (!blockUntil) {
            return false;
        }

        if (now >= blockUntil) {
            // El bloqueo ha expirado
            this.blockedClients.delete(clientId);
            return false;
        }

        return true;
    }

    public getBlockedClients(): string[] {
        const now = Date.now();
        const blocked: string[] = [];

        for (const [clientId, blockUntil] of this.blockedClients.entries()) {
            if (now < blockUntil) {
                blocked.push(clientId);
            } else {
                // Limpiar bloqueos expirados
                this.blockedClients.delete(clientId);
            }
        }

        return blocked;
    }

    public unblockClient(clientId: string): boolean {
        return this.blockedClients.delete(clientId);
    }

    public getRemainingBlockTime(clientId: string): number {
        const blockUntil = this.blockedClients.get(clientId);
        if (!blockUntil) {
            return 0;
        }

        const remaining = blockUntil - Date.now();
        return Math.max(0, remaining);
    }

    public getRequestCount(clientId: string): number {
        return this.requestCounts.get(clientId)?.length || 0;
    }

    public cleanup(): void {
        const now = Date.now();
        const windowStart = now - this.config.windowSizeMs;

        // Limpiar contadores antiguos
        for (const [clientId, requests] of this.requestCounts.entries()) {
            const recentRequests = requests.filter(time => time > windowStart);
            if (recentRequests.length === 0) {
                this.requestCounts.delete(clientId);
            } else {
                this.requestCounts.set(clientId, recentRequests);
            }
        }

        // Limpiar bloqueos expirados
        for (const [clientId, blockUntil] of this.blockedClients.entries()) {
            if (now >= blockUntil) {
                this.blockedClients.delete(clientId);
            }
        }
    }
}