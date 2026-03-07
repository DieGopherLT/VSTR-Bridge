import * as http from 'http';
import { SecurityMiddleware, SecurityMiddlewareDependencies } from '.';
import { SecurityConfig } from '../types';

const buildMockAuthManager = () => ({
  validateToken: jest.fn().mockReturnValue(true),
  extractTokenFromRequest: jest.fn().mockReturnValue('valid-token'),
  getToken: jest.fn().mockReturnValue('valid-token'),
  regenerateToken: jest.fn().mockReturnValue('new-token'),
});

const buildMockCommandValidator = () => ({
  validateCommand: jest.fn().mockReturnValue({ isValid: true, reason: '' }),
  addSafeCommand: jest.fn(),
  removeSafeCommand: jest.fn(),
  getSafeCommands: jest.fn().mockReturnValue([]),
});

const buildMockRateLimiter = () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  getClientId: jest.fn().mockReturnValue('client-1'),
  cleanup: jest.fn(),
  getBlockedClients: jest.fn().mockReturnValue([]),
  unblockClient: jest.fn().mockReturnValue(true),
});

const buildMockCorsManager = () => ({
  validateOrigin: jest.fn().mockReturnValue(true),
  setCorsHeaders: jest.fn(),
  handlePreflightRequest: jest.fn(),
  getAllowedOrigins: jest.fn().mockReturnValue(['vscode-file://', 'vscode-app://']),
});

const buildMockAuditLogger = () => ({
  logSecurityEvent: jest.fn(),
  logAuthFailure: jest.fn(),
  logCommandBlocked: jest.fn(),
  logRateLimitExceeded: jest.fn(),
  logSuspiciousActivity: jest.fn(),
  getLogStats: jest.fn().mockReturnValue({ size: 0, entries: 0 }),
  getLogPath: jest.fn().mockReturnValue('/tmp/audit.log'),
  initialize: jest.fn(),
  clearLogs: jest.fn(),
});

const buildConfig = (overrides: Partial<SecurityConfig> = {}): SecurityConfig => ({
  strictMode: true,
  enableRateLimit: true,
  enableCommandValidation: true,
  enableAuditLogging: true,
  allowedOrigins: [],
  rateLimitConfig: {
    maxRequestsPerMinute: 30,
    windowSizeMs: 60000,
    blockDurationMs: 300000,
  },
  validationConfig: {
    dangerousCommands: { unix: [], windows: [], common: [] },
    developmentSafeCommands: [],
    dangerousPatterns: [],
    maxCommandLength: 1000,
  },
  ...overrides,
});

const buildMockRequest = (overrides: Partial<http.IncomingMessage> = {}): http.IncomingMessage =>
  ({
    headers: { authorization: 'Bearer valid-token', origin: undefined },
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  }) as unknown as http.IncomingMessage;

const buildMockResponse = (): jest.Mocked<Pick<http.ServerResponse, 'setHeader' | 'writeHead' | 'end'>> => ({
  setHeader: jest.fn(),
  writeHead: jest.fn(),
  end: jest.fn(),
});

const buildDependencies = (
  overrides: Partial<SecurityMiddlewareDependencies> = {}
): SecurityMiddlewareDependencies => ({
  authManager: buildMockAuthManager() as any,
  commandValidator: buildMockCommandValidator() as any,
  rateLimiter: buildMockRateLimiter() as any,
  corsManager: buildMockCorsManager() as any,
  auditLogger: buildMockAuditLogger() as any,
  ...overrides,
});

describe('SecurityMiddleware', () => {
  let middleware: SecurityMiddleware;
  let deps: SecurityMiddlewareDependencies;
  let config: SecurityConfig;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    config = buildConfig();
    deps = buildDependencies();
    middleware = new SecurityMiddleware(config, '/tmp/bridge', deps);
  });

  afterEach(() => {
    middleware.cleanup();
    jest.useRealTimers();
  });

  describe('validateRequest', () => {
    it('returns true for a fully valid request', () => {
      const req = buildMockRequest();
      const res = buildMockResponse();

      const isValid = middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(isValid).toBe(true);
    });

    it('returns false and sends 403 when the origin is not allowed', () => {
      const corsManager = buildMockCorsManager();
      corsManager.validateOrigin.mockReturnValue(false);
      middleware = new SecurityMiddleware(config, '/tmp/bridge', { ...deps, corsManager: corsManager as any });
      const req = buildMockRequest({ headers: { origin: 'http://evil.com' } });
      const res = buildMockResponse();

      const isValid = middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(isValid).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    });

    it('logs suspicious activity when origin is rejected', () => {
      const corsManager = buildMockCorsManager();
      corsManager.validateOrigin.mockReturnValue(false);
      const auditLogger = buildMockAuditLogger();
      middleware = new SecurityMiddleware(config, '/tmp/bridge', {
        ...deps,
        corsManager: corsManager as any,
        auditLogger: auditLogger as any,
      });
      const req = buildMockRequest({ headers: { origin: 'http://evil.com' } });
      const res = buildMockResponse();

      middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(auditLogger.logSuspiciousActivity).toHaveBeenCalled();
    });

    it('returns false and sends 429 when rate limit is exceeded', () => {
      const rateLimiter = buildMockRateLimiter();
      rateLimiter.checkRateLimit.mockReturnValue(false);
      middleware = new SecurityMiddleware(config, '/tmp/bridge', { ...deps, rateLimiter: rateLimiter as any });
      const req = buildMockRequest();
      const res = buildMockResponse();

      const isValid = middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(isValid).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(429, expect.any(Object));
    });

    it('logs rate limit exceeded when rate limit check fails', () => {
      const rateLimiter = buildMockRateLimiter();
      rateLimiter.checkRateLimit.mockReturnValue(false);
      const auditLogger = buildMockAuditLogger();
      middleware = new SecurityMiddleware(config, '/tmp/bridge', {
        ...deps,
        rateLimiter: rateLimiter as any,
        auditLogger: auditLogger as any,
      });
      const req = buildMockRequest();
      const res = buildMockResponse();

      middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(auditLogger.logRateLimitExceeded).toHaveBeenCalled();
    });

    it('returns false and sends 401 when authorization header is missing', () => {
      const authManager = buildMockAuthManager();
      authManager.extractTokenFromRequest.mockReturnValue(null);
      middleware = new SecurityMiddleware(config, '/tmp/bridge', { ...deps, authManager: authManager as any });
      const req = buildMockRequest({ headers: {} });
      const res = buildMockResponse();

      const isValid = middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(isValid).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    });

    it('returns false and sends 401 when the token is invalid', () => {
      const authManager = buildMockAuthManager();
      authManager.extractTokenFromRequest.mockReturnValue('bad-token');
      authManager.validateToken.mockReturnValue(false);
      middleware = new SecurityMiddleware(config, '/tmp/bridge', { ...deps, authManager: authManager as any });
      const req = buildMockRequest({ headers: { authorization: 'Bearer bad-token' } });
      const res = buildMockResponse();

      const isValid = middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(isValid).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    });

    it('logs auth failure when authentication fails', () => {
      const authManager = buildMockAuthManager();
      authManager.extractTokenFromRequest.mockReturnValue('bad-token');
      authManager.validateToken.mockReturnValue(false);
      const auditLogger = buildMockAuditLogger();
      middleware = new SecurityMiddleware(config, '/tmp/bridge', {
        ...deps,
        authManager: authManager as any,
        auditLogger: auditLogger as any,
      });
      const req = buildMockRequest({ headers: { authorization: 'Bearer bad-token' } });
      const res = buildMockResponse();

      middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(auditLogger.logAuthFailure).toHaveBeenCalled();
    });

    it('skips authentication check for OPTIONS method (preflight)', () => {
      const authManager = buildMockAuthManager();
      authManager.extractTokenFromRequest.mockReturnValue(null);
      middleware = new SecurityMiddleware(config, '/tmp/bridge', { ...deps, authManager: authManager as any });
      const req = buildMockRequest({ method: 'OPTIONS', headers: {} });
      const res = buildMockResponse();

      const isValid = middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(isValid).toBe(true);
    });

    it('does not check rate limit when enableRateLimit is false', () => {
      const rateLimiter = buildMockRateLimiter();
      rateLimiter.checkRateLimit.mockReturnValue(false);
      const configWithoutRateLimit = buildConfig({ enableRateLimit: false });
      middleware = new SecurityMiddleware(configWithoutRateLimit, '/tmp/bridge', {
        ...deps,
        rateLimiter: rateLimiter as any,
      });
      const req = buildMockRequest();
      const res = buildMockResponse();

      const isValid = middleware.validateRequest(req, res as unknown as http.ServerResponse);

      expect(isValid).toBe(true);
      expect(rateLimiter.checkRateLimit).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('calls clearInterval to stop the cleanup timer', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      middleware.cleanup();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('calls cleanup on the rate limiter', () => {
      middleware.cleanup();

      expect((deps.rateLimiter as any).cleanup).toHaveBeenCalled();
    });
  });

  describe('getSecurityStats', () => {
    it('returns an object with blockedClients count', () => {
      const stats = middleware.getSecurityStats();

      expect(stats).toHaveProperty('blockedClients');
      expect(typeof stats.blockedClients).toBe('number');
    });

    it('returns an object with allowedOrigins array', () => {
      const stats = middleware.getSecurityStats();

      expect(stats).toHaveProperty('allowedOrigins');
      expect(Array.isArray(stats.allowedOrigins)).toBe(true);
    });

    it('returns an object with safeCommandsCount', () => {
      const stats = middleware.getSecurityStats();

      expect(stats).toHaveProperty('safeCommandsCount');
    });

    it('returns an object with logStats', () => {
      const stats = middleware.getSecurityStats();

      expect(stats).toHaveProperty('logStats');
    });

    it('returns config properties reflecting the current configuration', () => {
      const stats = middleware.getSecurityStats();

      expect(stats.config.strictMode).toBe(true);
      expect(stats.config.rateLimit).toBe(true);
      expect(stats.config.commandValidation).toBe(true);
      expect(stats.config.auditLogging).toBe(true);
    });
  });

  describe('validateCommand', () => {
    it('returns true when command validation is disabled', () => {
      const configWithoutValidation = buildConfig({ enableCommandValidation: false });
      middleware = new SecurityMiddleware(configWithoutValidation, '/tmp/bridge', deps);

      const isValid = middleware.validateCommand('rm -rf /', 'client-1');

      expect(isValid).toBe(true);
    });

    it('returns true when the command passes validation', () => {
      const isValid = middleware.validateCommand('echo hello', 'client-1');

      expect(isValid).toBe(true);
    });

    it('returns false and logs when the command is blocked', () => {
      const commandValidator = buildMockCommandValidator();
      commandValidator.validateCommand.mockReturnValue({ isValid: false, reason: 'dangerous command' });
      const auditLogger = buildMockAuditLogger();
      middleware = new SecurityMiddleware(config, '/tmp/bridge', {
        ...deps,
        commandValidator: commandValidator as any,
        auditLogger: auditLogger as any,
      });

      const isValid = middleware.validateCommand('rm -rf /', 'client-1');

      expect(isValid).toBe(false);
      expect(auditLogger.logCommandBlocked).toHaveBeenCalled();
    });
  });

  describe('getAuthToken', () => {
    it('delegates to the auth manager', () => {
      const token = middleware.getAuthToken();

      expect(token).toBe('valid-token');
    });
  });
});
