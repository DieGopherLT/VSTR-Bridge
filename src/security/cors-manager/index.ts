import * as http from 'http';

export const VSCODE_ALLOWED_ORIGINS = ['vscode-file://', 'vscode-app://'] as const;

export class CorsManager {
  private allowedOrigins: Set<string>;
  private allowCredentials: boolean;
  private allowedMethods: string[];
  private allowedHeaders: string[];

  constructor(allowedOrigins: string[] = [], allowCredentials = false) {
    this.allowedOrigins = new Set([...VSCODE_ALLOWED_ORIGINS, ...allowedOrigins]);
    this.allowCredentials = allowCredentials;
    this.allowedMethods = ['GET', 'POST', 'OPTIONS'];
    this.allowedHeaders = ['Content-Type', 'Authorization'];
  }

  public validateOrigin(req: http.IncomingMessage): boolean {
    const origin = req.headers.origin;

    // Si no hay origen (requests locales), permitir
    if (!origin) {
      return true;
    }

    // Verificar si el origen está en la lista permitida
    return this.allowedOrigins.has(origin);
  }

  public setCorsHeaders(res: http.ServerResponse, req: http.IncomingMessage): void {
    const origin = req.headers.origin;

    if (origin && this.allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // Para requests locales sin origen
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', this.allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', this.allowedHeaders.join(', '));

    if (this.allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Headers de seguridad adicionales
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  public handlePreflightRequest(res: http.ServerResponse, req: http.IncomingMessage): void {
    this.setCorsHeaders(res, req);
    res.writeHead(200);
    res.end();
  }

  public addAllowedOrigin(origin: string): void {
    this.allowedOrigins.add(origin);
  }

  public removeAllowedOrigin(origin: string): void {
    this.allowedOrigins.delete(origin);
  }

  public getAllowedOrigins(): string[] {
    return Array.from(this.allowedOrigins);
  }

  public isOriginAllowed(origin: string): boolean {
    return this.allowedOrigins.has(origin);
  }
}
