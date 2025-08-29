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

**VSCodeBridge** (`src/vscode-bridge.ts`):
- Main HTTP server handling CLI communication
- Integrates SQLite database for secure token management
- Manages terminal creation and command execution
- Handles `/ping`, `/task`, `/workspace`, and `/security/status` endpoints
- Implements token pool with automatic refill mechanism

**Security System** (`src/security/`):
- `SecurityMiddleware`: Central security orchestrator
- `AuthManager`: Token-based authentication with timing-safe validation
- `CommandValidator`: Blocks dangerous commands and patterns using blacklists
- `RateLimiter`: Request rate limiting per client
- `AuditLogger`: Security event logging
- `CorsManager`: CORS policy enforcement (vscode-file://, vscode-app://)

**Database System** (`src/database/`):
- `DatabaseManager`: SQLite connection with 600 permissions in ~/.config/vstr/
- `CredentialsPublisher`: Encrypted token pool management with TTL
- `Models`: Instance and Credential tables with relationships

**Encryption System** (`src/cipher/`):
- `CryptoManager`: AES-256-CBC encryption with PBKDF2 key derivation
- `keyDerivation`: System-specific key generation from USER:homedir:uid:platform

### Security Features

The extension implements defense-in-depth security:

1. **Encrypted Authentication**: 
   - Tokens encrypted with AES-256-CBC + PBKDF2 (100,000 iterations)
   - System-derived keys from USER:homedir:uid:platform combination
   - Timing-safe token validation to prevent timing attacks
   - Token pool with automatic expiration (5 minutes TTL)

2. **Command Validation**: 
   - Blacklist of dangerous commands (rm, sudo, curl, etc.) per platform
   - Suspicious pattern detection (shell injection, directory traversal, etc.)
   - Maximum command length limits
   - User-configurable safe command whitelist

3. **Database Security**:
   - SQLite file with 600 permissions (owner read/write only)
   - Located in user home directory (~/.config/vstr/)
   - Encrypted credentials stored as ciphertext + salt + IV
   - Automatic cleanup of expired tokens

4. **Network Security**:
   - Rate limiting: 30 requests/minute per client by default
   - CORS restricted to VSCode origins only (vscode-file://, vscode-app://)
   - localhost-only binding
   - Security headers (X-Content-Type-Options, X-Frame-Options, etc.)

5. **Audit Logging**: All security events logged with severity levels
6. **Zero Trust Policy**: Only accepts requests from verified VSCode terminals

### Configuration

Security settings configurable via VSCode settings (`vstrBridge.security.*`):
- `strictMode`: Enable/disable strict security (default: true)
- `additionalSafeCommands`: Array of additional allowed commands
- `maxRequestsPerMinute`: Rate limit threshold (default: 30)
- `auditLogging`: Enable security event logging (default: true)

### Bridge Registration

**Setup Phase (CLI Responsibility)**:
1. CLI creates SQLite database (~/.config/vstr/messenger.db) with 600 permissions
2. CLI initializes database schema (instances, credentials tables)

**Runtime Phase (Extension Responsibility)**:
1. Extension finds available port on localhost
2. Derives system-specific encryption key deterministically
3. Registers instance in database (PID + port + workspace)
4. Generates and encrypts initial token pool (3 tokens with 5-minute TTL)
5. Starts HTTP server with security middleware
6. Maintains token pool with reactive refill mechanism
7. Cleans up instance and credentials on deactivation

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