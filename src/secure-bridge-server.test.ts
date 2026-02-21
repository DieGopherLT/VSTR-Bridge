jest.mock(
  'vscode',
  () => ({
    ThemeIcon: jest.fn().mockImplementation((id: string) => ({ id })),
    ThemeColor: jest.fn().mockImplementation((id: string) => ({ id })),
  }),
  { virtual: true }
);

import * as http from 'http';
import { SecureBridgeServer, VSCodeAdapter, SecureBridgeServerDependencies } from './secure-bridge-server';
import { SecurityConfig } from './security';

jest.mock('http', () => ({
  createServer: jest.fn(),
}));

const buildMockHttpServer = () => ({
  listen: jest.fn().mockImplementation((_port: unknown, _host: unknown, cb: () => void) => cb && cb()),
  close: jest.fn().mockImplementation((cb: () => void) => cb && cb()),
  address: jest.fn().mockReturnValue({ port: 3000 }),
});

const buildMockVSCodeAdapter = (): jest.Mocked<VSCodeAdapter> => ({
  showInformationMessage: jest.fn().mockResolvedValue(undefined),
  showErrorMessage: jest.fn().mockResolvedValue(undefined),
  showWarningMessage: jest.fn(),
  getWorkspaceName: jest.fn().mockReturnValue('TestWorkspace'),
  getWorkspaceFolders: jest.fn().mockReturnValue([{ uri: { fsPath: '/home/user/project' }, name: 'project' }]),
  getConfiguration: jest.fn().mockReturnValue({}),
  createTerminal: jest.fn().mockReturnValue({ show: jest.fn(), sendText: jest.fn() }),
  openTextDocument: jest.fn().mockResolvedValue({}),
  showTextDocument: jest.fn(),
  executeCommand: jest.fn(),
  setEnvironmentVariable: jest.fn(),
});

const buildMockFileManager = () => ({
  initialize: jest.fn(),
  getBridgeDirectory: jest.fn().mockReturnValue('/tmp/bridge'),
  writeBridgeInfo: jest.fn().mockReturnValue('/tmp/bridge/info.json'),
  cleanupBridgeFile: jest.fn(),
  cleanupStaleFiles: jest.fn(),
  validateFileIntegrity: jest.fn().mockReturnValue(true),
});

const buildMockSecurityMiddleware = () => ({
  validateRequest: jest.fn().mockReturnValue(true),
  validateCommand: jest.fn().mockReturnValue(true),
  handlePreflightRequest: jest.fn(),
  getAuthToken: jest.fn().mockReturnValue('test-auth-token'),
  getClientId: jest.fn().mockReturnValue('client-1'),
  getSecurityStats: jest.fn().mockReturnValue({
    blockedClients: 0,
    allowedOrigins: [],
    safeCommandsCount: 0,
    logStats: { entries: 0, size: 0 },
    config: { strictMode: true, rateLimit: true, commandValidation: true, auditLogging: true },
  }),
  getAuditLogger: jest.fn().mockReturnValue({
    logSecurityEvent: jest.fn(),
    getLogPath: jest.fn().mockReturnValue('/tmp/audit.log'),
  }),
  cleanup: jest.fn(),
});

const buildConfig = (): SecurityConfig => ({
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
});

const buildDependencies = (
  overrides: Partial<SecureBridgeServerDependencies> = {}
): SecureBridgeServerDependencies => ({
  fileManager: buildMockFileManager() as any,
  securityMiddleware: buildMockSecurityMiddleware() as any,
  ...overrides,
});

describe('SecureBridgeServer', () => {
  let vsCodeAdapter: jest.Mocked<VSCodeAdapter>;
  let config: SecurityConfig;
  let deps: SecureBridgeServerDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    (http.createServer as jest.Mock).mockImplementation(() => buildMockHttpServer());
    vsCodeAdapter = buildMockVSCodeAdapter();
    config = buildConfig();
    deps = buildDependencies();
  });

  describe('constructor', () => {
    it('creates an instance with valid dependencies without throwing', () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      expect(server).toBeInstanceOf(SecureBridgeServer);
    });

    it('calls initialize on the file manager during construction', () => {
      new SecureBridgeServer(vsCodeAdapter, config, deps);

      expect((deps.fileManager as any).initialize).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('calls http.createServer to set up the HTTP server', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      await server.start();

      expect(http.createServer).toHaveBeenCalled();
    });

    it('calls cleanupStaleFiles after starting', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      await server.start();

      expect((deps.fileManager as any).cleanupStaleFiles).toHaveBeenCalled();
    });

    it('calls showInformationMessage when the server starts successfully', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      await server.start();

      expect(vsCodeAdapter.showInformationMessage).toHaveBeenCalled();
    });

    it('registers the bridge by writing bridge info after start', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      await server.start();

      expect((deps.fileManager as any).writeBridgeInfo).toHaveBeenCalled();
    });

    it('injects the VSTR environment variable after start', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      await server.start();

      expect(vsCodeAdapter.setEnvironmentVariable).toHaveBeenCalledWith('VSTR', expect.any(String));
    });

    it('injects the VSTR_TOKEN environment variable after start', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      await server.start();

      expect(vsCodeAdapter.setEnvironmentVariable).toHaveBeenCalledWith('VSTR_TOKEN', 'test-auth-token');
    });
  });

  describe('stop', () => {
    it('calls cleanup on the security middleware', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();

      server.stop();

      expect((deps.securityMiddleware as any).cleanup).toHaveBeenCalled();
    });

    it('calls cleanupBridgeFile with the registered bridge path', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();

      server.stop();

      expect((deps.fileManager as any).cleanupBridgeFile).toHaveBeenCalledWith('/tmp/bridge/info.json');
    });

    it('closes the HTTP server', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const mockServer = (http.createServer as jest.Mock).mock.results[0].value;

      server.stop();

      expect(mockServer.close).toHaveBeenCalled();
    });
  });

  describe('showStatus', () => {
    it('calls getSecurityStats on the security middleware', () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      server.showStatus();

      expect((deps.securityMiddleware as any).getSecurityStats).toHaveBeenCalled();
    });

    it('calls showInformationMessage with a message containing workspace name', () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      server.showStatus();

      expect(vsCodeAdapter.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('TestWorkspace'),
        'View Logs',
        'Security Config'
      );
    });

    it('calls showInformationMessage with a message about bridge status', () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);

      server.showStatus();

      expect(vsCodeAdapter.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Active'),
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('request handling', () => {
    const buildMockRequest = (
      overrides: Partial<{
        method: string;
        url: string;
        headers: Record<string, string>;
        body: string;
      }> = {}
    ) => {
      const { body = '', method = 'GET', url = '/ping', headers = {} } = overrides;
      const req: Record<string, unknown> = {
        method,
        url,
        headers,
        socket: { remoteAddress: '127.0.0.1' },
      };
      req.on = jest.fn().mockImplementation((event: string, cb: Function) => {
        if (event === 'end') {
          setTimeout(() => cb(), 0);
        }
        if (event === 'data' && body) {
          setTimeout(() => cb(Buffer.from(body)), 0);
        }
        return req;
      });
      return req;
    };

    const buildMockResponse = () => ({
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      end: jest.fn(),
    });

    const getRequestHandler = () => {
      const calls = (http.createServer as jest.Mock).mock.calls;
      // findAvailablePort calls createServer without a handler (no args[0] function),
      // the actual server is the call that receives the request handler function.
      const handlerCall = calls.find((args) => typeof args[0] === 'function');
      return handlerCall?.[0] as Function;
    };

    it('responds 200 to GET /ping', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'GET', url: '/ping' });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 10));
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('responds 404 for an unknown route', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'GET', url: '/unknown' });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 10));
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });

    it('responds 405 when GET is used on /task', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'GET', url: '/task' });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 10));
      expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
    });

    it('responds 405 when GET is used on /workspace', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'GET', url: '/workspace' });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 10));
      expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
    });

    it('responds 200 to GET /security/status', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'GET', url: '/security/status' });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 10));
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('handles OPTIONS method as preflight without going through auth', async () => {
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'OPTIONS', url: '/ping' });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 10));
      expect((deps.securityMiddleware as any).handlePreflightRequest).toHaveBeenCalled();
    });

    it('returns early without processing when validateRequest fails', async () => {
      (deps.securityMiddleware as any).validateRequest.mockReturnValue(false);
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'GET', url: '/ping' });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 10));
      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('creates a terminal and responds 200 for POST /task with valid body', async () => {
      const taskBody = JSON.stringify({
        name: 'My Task',
        path: '/home/user/project',
        cmds: ['npm install'],
      });
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'POST', url: '/task', body: taskBody });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 50));
      expect(vsCodeAdapter.createTerminal).toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('responds 403 for POST /task when command is blocked by security policy', async () => {
      (deps.securityMiddleware as any).validateCommand.mockReturnValue(false);
      const taskBody = JSON.stringify({
        name: 'Blocked Task',
        path: '/home/user/project',
        cmds: ['rm -rf /'],
      });
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'POST', url: '/task', body: taskBody });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 50));
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    });

    it('creates terminals and responds 200 for POST /workspace with valid tasks', async () => {
      const workspaceBody = JSON.stringify({
        name: 'My Workspace',
        tasks: [
          { name: 'Frontend', path: '/project/frontend', cmds: ['npm start'] },
          { name: 'Backend', path: '/project/backend', cmds: ['go run .'] },
        ],
      });
      const server = new SecureBridgeServer(vsCodeAdapter, config, deps);
      await server.start();
      const handler = getRequestHandler();
      const req = buildMockRequest({ method: 'POST', url: '/workspace', body: workspaceBody });
      const res = buildMockResponse();

      handler(req, res);

      await new Promise((r) => setTimeout(r, 500));
      expect(vsCodeAdapter.createTerminal).toHaveBeenCalledTimes(2);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });
  });
});
