import * as crypto from 'crypto';
import * as fs from 'fs';

export class AuthManager {
  private authToken: string;
  private readonly tokenLength = 32;
  private tokenGenerator: () => string;

  constructor(tokenGenerator: () => string = () => crypto.randomBytes(32).toString('hex')) {
    this.tokenGenerator = tokenGenerator;
    this.authToken = this.tokenGenerator();
  }

  private generateSecureToken(): string {
    return this.tokenGenerator();
  }

  public getToken(): string {
    return this.authToken;
  }

  public validateToken(providedToken: string): boolean {
    if (!providedToken) {
      return false;
    }

    const storedBuffer = Buffer.from(this.authToken, 'hex');
    const providedBuffer = Buffer.from(providedToken, 'hex');

    if (storedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(storedBuffer, providedBuffer);
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
