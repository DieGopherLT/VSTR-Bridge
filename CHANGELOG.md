# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-12

First release.

### Added

- Local HTTP bridge server enabling the VSTR CLI to open terminals and execute commands within VSCode
- Token-based authentication for CLI-extension communication
- Automatic environment variable injection (`VSTR` and `VSTR_TOKEN`) into integrated terminals
- Tilde path resolution (`~/`) for terminal working directories
- Command validation blocking dangerous operations
- Per-client rate limiting (30 requests/minute by default)
- Audit logging for security events
- CORS enforcement restricted to VSCode origins
- "VSTR Bridge: Show Status" command
- "VSTR Bridge: Restart" command

[Unreleased]: https://github.com/DieGopherLT/VSTR-Bridge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/DieGopherLT/VSTR-Bridge/releases/tag/v0.1.0
