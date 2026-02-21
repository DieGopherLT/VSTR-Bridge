import * as http from 'http';
import { CorsManager } from './cors-manager';

const buildMockRequest = (origin?: string, method = 'GET'): http.IncomingMessage => {
  const req = {
    headers: { origin },
    method,
  } as unknown as http.IncomingMessage;
  return req;
};

const buildMockResponse = (): jest.Mocked<Pick<http.ServerResponse, 'setHeader' | 'writeHead' | 'end'>> => ({
  setHeader: jest.fn(),
  writeHead: jest.fn(),
  end: jest.fn(),
});

describe('CorsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isOriginAllowed', () => {
    it('allows the vscode-file:// origin by default', () => {
      const manager = new CorsManager();

      expect(manager.isOriginAllowed('vscode-file://')).toBe(true);
    });

    it('allows the vscode-app:// origin by default', () => {
      const manager = new CorsManager();

      expect(manager.isOriginAllowed('vscode-app://')).toBe(true);
    });

    it('rejects an arbitrary external origin', () => {
      const manager = new CorsManager();

      expect(manager.isOriginAllowed('http://evil.com')).toBe(false);
    });

    it('allows a custom origin passed to the constructor', () => {
      const manager = new CorsManager(['http://localhost:3000']);

      expect(manager.isOriginAllowed('http://localhost:3000')).toBe(true);
    });

    it('rejects an origin not in the constructor list', () => {
      const manager = new CorsManager(['http://localhost:3000']);

      expect(manager.isOriginAllowed('http://localhost:9999')).toBe(false);
    });
  });

  describe('validateOrigin', () => {
    it('allows a request with no origin header', () => {
      const manager = new CorsManager();
      const req = buildMockRequest(undefined);

      expect(manager.validateOrigin(req)).toBe(true);
    });

    it('allows a request with a permitted origin', () => {
      const manager = new CorsManager();
      const req = buildMockRequest('vscode-file://');

      expect(manager.validateOrigin(req)).toBe(true);
    });

    it('rejects a request with a forbidden origin', () => {
      const manager = new CorsManager();
      const req = buildMockRequest('http://evil.com');

      expect(manager.validateOrigin(req)).toBe(false);
    });
  });

  describe('setCorsHeaders', () => {
    it('sets Access-Control-Allow-Origin to the matched origin when it is allowed', () => {
      const manager = new CorsManager();
      const req = buildMockRequest('vscode-file://');
      const res = buildMockResponse();

      manager.setCorsHeaders(res as unknown as http.ServerResponse, req);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'vscode-file://');
    });

    it('sets Access-Control-Allow-Origin to wildcard when no origin is present', () => {
      const manager = new CorsManager();
      const req = buildMockRequest(undefined);
      const res = buildMockResponse();

      manager.setCorsHeaders(res as unknown as http.ServerResponse, req);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('does not set Access-Control-Allow-Origin for a forbidden origin', () => {
      const manager = new CorsManager();
      const req = buildMockRequest('http://evil.com');
      const res = buildMockResponse();

      manager.setCorsHeaders(res as unknown as http.ServerResponse, req);

      const originCalls = (res.setHeader as jest.Mock).mock.calls.filter(
        ([header]) => header === 'Access-Control-Allow-Origin'
      );
      expect(originCalls).toHaveLength(0);
    });

    it('sets Access-Control-Allow-Methods header', () => {
      const manager = new CorsManager();
      const req = buildMockRequest('vscode-file://');
      const res = buildMockResponse();

      manager.setCorsHeaders(res as unknown as http.ServerResponse, req);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.stringContaining('GET'));
    });

    it('sets Access-Control-Allow-Headers header', () => {
      const manager = new CorsManager();
      const req = buildMockRequest('vscode-file://');
      const res = buildMockResponse();

      manager.setCorsHeaders(res as unknown as http.ServerResponse, req);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        expect.stringContaining('Authorization')
      );
    });

    it('sets security headers including X-Content-Type-Options', () => {
      const manager = new CorsManager();
      const req = buildMockRequest('vscode-file://');
      const res = buildMockResponse();

      manager.setCorsHeaders(res as unknown as http.ServerResponse, req);

      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('sets Access-Control-Allow-Credentials when allowCredentials is true', () => {
      const manager = new CorsManager([], true);
      const req = buildMockRequest('vscode-file://');
      const res = buildMockResponse();

      manager.setCorsHeaders(res as unknown as http.ServerResponse, req);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });

    it('does not set Access-Control-Allow-Credentials when allowCredentials is false', () => {
      const manager = new CorsManager([], false);
      const req = buildMockRequest('vscode-file://');
      const res = buildMockResponse();

      manager.setCorsHeaders(res as unknown as http.ServerResponse, req);

      const credentialsCalls = (res.setHeader as jest.Mock).mock.calls.filter(
        ([header]) => header === 'Access-Control-Allow-Credentials'
      );
      expect(credentialsCalls).toHaveLength(0);
    });
  });

  describe('handlePreflightRequest', () => {
    it('responds with 200 status for a preflight request', () => {
      const manager = new CorsManager();
      const req = buildMockRequest('vscode-file://', 'OPTIONS');
      const res = buildMockResponse();

      manager.handlePreflightRequest(res as unknown as http.ServerResponse, req);

      expect(res.writeHead).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('addAllowedOrigin and removeAllowedOrigin', () => {
    it('allows a dynamically added origin', () => {
      const manager = new CorsManager();

      manager.addAllowedOrigin('http://localhost:4000');

      expect(manager.isOriginAllowed('http://localhost:4000')).toBe(true);
    });

    it('rejects an origin after it is removed', () => {
      const manager = new CorsManager(['http://localhost:4000']);

      manager.removeAllowedOrigin('http://localhost:4000');

      expect(manager.isOriginAllowed('http://localhost:4000')).toBe(false);
    });
  });

  describe('getAllowedOrigins', () => {
    it('returns an array that includes the default vscode origins', () => {
      const manager = new CorsManager();

      const origins = manager.getAllowedOrigins();

      expect(origins).toContain('vscode-file://');
      expect(origins).toContain('vscode-app://');
    });

    it('returns an array that includes custom origins from the constructor', () => {
      const manager = new CorsManager(['http://localhost:5000']);

      const origins = manager.getAllowedOrigins();

      expect(origins).toContain('http://localhost:5000');
    });
  });
});
