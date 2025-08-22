import * as crypto from 'crypto';
import * as fs from 'fs';

export class AuthManager {
    private authToken: string;
    private readonly tokenLength = 32;

    constructor() {
        this.authToken = this.generateSecureToken();
    }

    private generateSecureToken(): string {
        return crypto.randomBytes(this.tokenLength).toString('hex');
    }

    public getToken(): string {
        return this.authToken;
    }

    public validateToken(providedToken: string): boolean {
        if (!providedToken) {
            return false;
        }

        return crypto.timingSafeEqual(
            Buffer.from(this.authToken, 'hex'),
            Buffer.from(providedToken, 'hex')
        );
    }

    public extractTokenFromRequest(authHeader?: string): string | null {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        
        return authHeader.substring(7); // Remove "Bearer " prefix
    }

    public regenerateToken(): string {
        this.authToken = this.generateSecureToken();
        return this.authToken;
    }

    public validateFilePermissions(filePath: string): boolean {
        try {
            const stats = fs.statSync(filePath);
            
            if (process.platform === 'win32') {
                // En Windows, validación limitada - verificar que es un archivo válido
                return stats.isFile();
            }
            
            const mode = stats.mode & parseInt('777', 8);
            
            // CORREGIDO: Solo owner con permisos de lectura/escritura exclusivos
            return mode === 0o600 || mode === 0o400; // Solo lectura o lectura-escritura para owner
        } catch {
            return false;
        }
    }
}