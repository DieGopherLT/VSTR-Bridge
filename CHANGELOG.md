# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-06-12

### Changed

- Refactored security modules into feature subdirectories for better code organization
- Applied DRY principles across security components

### Fixed

- Path traversal vulnerability in file manager security module

## [0.2.0] - 2025-12-01

### Added

- Defense-in-depth security system:
  - Token-based authentication (`AuthManager`)
  - Command validation blocking dangerous patterns (`CommandValidator`)
  - Per-client rate limiting, 30 req/min by default (`RateLimiter`)
  - Security event audit logging (`AuditLogger`)
  - Secure bridge info file management (`SecureFileManager`)
  - CORS enforcement restricted to VSCode origins (`CorsManager`)
- `.vscodeignore` to exclude markdown files (except root `README.md`) from the packaged extension

### Fixed

- Bridge port no longer exposed in extension startup output

## [0.1.0] - 2025-10-01

### Added

- Base codebase: `SecureBridgeServer` HTTP server handling `/ping`, `/task`, `/workspace`, and `/security/status` endpoints
- TypeScript compilation pipeline targeting ES2020
- Tilde path resolution (`~/` support) for terminal working directories
- Initial `README.md`

### Fixed

- Path resolution for working directories starting with `~/`

[Unreleased]: https://github.com/DieGopherLT/VSTR-Bridge/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/DieGopherLT/VSTR-Bridge/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/DieGopherLT/VSTR-Bridge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/DieGopherLT/VSTR-Bridge/releases/tag/v0.1.0
