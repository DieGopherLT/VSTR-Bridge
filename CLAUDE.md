# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VSTR-Bridge is a secure VSCode extension that acts as a communication bridge between the VSCode Terminal Runner CLI and VSCode workspaces. It enables remote terminal command execution through a local HTTP server with comprehensive security features.

## Commands

### Development
```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Run linter
npm run lint

# Run tests (includes compilation and linting)
npm run pretest
```

### Extension Management
```bash
# Package extension for distribution
npm run package

# Install extension locally (after packaging)
npm run install-local

# Publish to marketplace
npm run publish
```

### VS Code Development
- Press `F5` to run extension in development mode (Extension Development Host)
- Use "VSTR Bridge: Show Status" command to check bridge status
- Security settings available at `vstrBridge.security.*`

## Architecture

### Core Components

**SecureBridgeServer** (`src/secure-bridge-server.ts`):
- Main HTTP server handling CLI communication
- Integrates all security middleware
- Manages terminal creation and command execution
- Handles `/ping`, `/task`, `/workspace`, and `/security/status` endpoints

**Security System** (`src/security/`):
- `SecurityMiddleware`: Central security orchestrator
- `AuthManager`: Token-based authentication
- `CommandValidator`: Blocks dangerous commands and patterns
- `RateLimiter`: Request rate limiting per client
- `AuditLogger`: Security event logging
- `SecureFileManager`: Safe bridge info file management
- `CorsManager`: CORS policy enforcement

### Security Features

The extension implements defense-in-depth security:

1. **Authentication**: Token-based auth with environment variable injection
2. **Command Validation**: Blocks dangerous commands (rm, sudo, etc.) and patterns
3. **Rate Limiting**: 30 requests/minute per client by default
4. **Audit Logging**: All security events logged with severity levels
5. **File Validation**: Secure bridge info file management in temp directory
6. **CORS Protection**: Restricted to VSCode origins only

### Configuration

Security settings configurable via VSCode settings (`vstrBridge.security.*`):
- `strictMode`: Enable/disable strict security (default: true)
- `additionalSafeCommands`: Array of additional allowed commands
- `maxRequestsPerMinute`: Rate limit threshold (default: 30)
- `auditLogging`: Enable security event logging (default: true)

### Bridge Registration

Extension automatically:
1. Finds available port on localhost
2. Creates bridge info file in temp directory with auth token
3. Injects `VSTR` and `VSTR_TOKEN` environment variables
4. Cleans up on deactivation

### Terminal Integration

Creates VSCode terminals with:
- Custom names and icons
- Tilde path resolution (`~/` support)
- Working directory context
- Theme color support

## Development Notes

- Extension activates on VSCode startup (`onStartupFinished`)
- HTTP server binds to localhost only for security
- All commands validated before terminal execution
- Bridge info cleanup handled automatically
- TypeScript compilation target: ES2020
- No external dependencies in runtime code