# VSTR-Bridge - VSCode Extension

> **Bridge the gap between CLI and VSCode** - Seamlessly execute terminal commands from VSCode Terminal Runner CLI

[![VSCode Marketplace](https://img.shields.io/badge/VSCode-Marketplace-blue?style=flat-square&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=vstr.bridge)
[![Version](https://img.shields.io/visual-studio-marketplace/v/vstr.bridge?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=vstr.bridge)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/vstr.bridge?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=vstr.bridge)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

## What is VSTR-Bridge?

VSTR-Bridge is the **VSCode extension component** of the VSCode Terminal Runner ecosystem. It acts as a communication bridge between the [VSTR CLI tool](https://github.com/DieGopherLT/vscode-terminal-runner) and your VSCode workspace, enabling seamless terminal automation directly within your editor.

**This extension is designed to work with the [VSCode Terminal Runner CLI](https://github.com/DieGopherLT/vscode-terminal-runner)**

## How It Works

1. **CLI Command**: You run `vstr workspace run my-project` in your terminal
2. **Bridge Discovery**: CLI automatically detects the active VSCode instance
3. **Terminal Creation**: Extension creates terminals and executes commands within VSCode
4. **Workspace Integration**: All commands run in the context of your current workspace

## Key Features

- **Automatic Discovery**: CLI automatically finds the correct VSCode instance
- **Zero-Configuration**: Works out of the box with any VSCode workspace
- **Multi-Instance Support**: Handles multiple VSCode windows intelligently
- **Context-Aware**: Commands execute in the correct workspace directory
- **Secure Communication**: Local HTTP server with process validation
- **Status Monitoring**: Real-time bridge status and health checks

## Getting Started

### Installation

#### Recommended: Via CLI (Automatic)
```bash
vstr setup  # Automatically installs and configures the extension
```

#### Manual: From VSCode Marketplace
If the CLI method isn't available, you can install manually:
1. Open VSCode
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "VSTR-Bridge"
4. Click Install

**Or visit:** [VSCode Marketplace - VSTR-Bridge](https://marketplace.visualstudio.com/items?itemName=vstr.bridge)

### Setup

1. **Install the Extension** (this repository)
2. **Install the CLI**: [VSCode Terminal Runner](https://github.com/DieGopherLT/vscode-terminal-runner)
3. **Open a workspace in VSCode**
4. **Start using VSTR commands** - the bridge will activate automatically

### Verification

To verify the bridge is working:

1. Open VSCode with a workspace
2. Run the command: **"VSTR Bridge: Show Status"** from Command Palette (`Ctrl+Shift+P`)
3. You should see bridge information including port and workspace details

## Technical Details

### Architecture

- **HTTP Server**: Lightweight local server running on random available port
- **Process Detection**: Smart parent process detection for VSCode integration
- **Environment Variables**: Automatic `VSTR` environment variable injection
- **File-based Discovery**: JSON metadata files for CLI discovery

### API Endpoints

The extension exposes these endpoints for CLI communication:

- `GET /ping` - Health check
- `POST /task` - Execute single task
- `POST /workspace` - Execute workspace configuration

### Bridge Registration

The extension automatically:
1. Finds an available port
2. Registers bridge metadata in temp directory
3. Sets environment variables for integrated terminals
4. Cleans up on deactivation

## Requirements

- **VSCode**: Version 1.74.0 or higher
- **Node.js**: Not required (bundled with extension)
- **VSTR CLI**: Install from [here](https://github.com/DieGopherLT/vscode-terminal-runner)

## Commands

| Command | Description |
|---------|-------------|
| `VSTR Bridge: Show Status` | Display bridge connection info |
| `VSTR Bridge: Restart` | Restart the bridge server |

## Configuration

The extension works with zero configuration out of the box! No setup required.

Optional customization available through VSCode settings if needed.

## Troubleshooting

### Bridge Not Found
```bash
# Check if extension is active
vstr status

# Restart VSCode and try again
# or manually restart bridge from Command Palette
```

### Multiple VSCode Instances
- The CLI will automatically prompt you to select the correct instance
- Each VSCode window runs its own bridge instance

### Port Conflicts
- Extension automatically finds available ports
- No manual configuration needed

## Related Projects

- **[VSCode Terminal Runner (CLI)](https://github.com/DieGopherLT/vscode-terminal-runner)** - The main CLI tool
- **[VSTR Documentation](https://github.com/DieGopherLT/vscode-terminal-runner/blob/main/docs/)** - Complete documentation

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

### Development Setup

```bash
# Clone the repository
git clone https://github.com/DieGopherLT/VSTR-Bridge.git
cd VSTR-Bridge

# Install dependencies
npm install

# Open in VSCode
code .

# Press F5 to run extension in development mode
```

### Building

```bash
# Compile TypeScript
npm run compile

# Package extension
npm run package

# Publish to marketplace
npm run publish
```

## System Requirements

- **VSCode**: 1.74.0+
- **Operating Systems**: Windows, macOS, Linux
- **Memory**: Minimal footprint (~2MB)
- **Network**: Local HTTP communication only

## Security & Privacy

- **Local Only**: All communication happens on localhost
- **No External Connections**: Extension never connects to external services
- **Process Validation**: Bridge validates parent VSCode process
- **Automatic Cleanup**: Removes metadata files on deactivation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [Report bugs](https://github.com/DieGopherLT/VSTR-Bridge/issues)
- **Feature Requests**: [Request features](https://github.com/DieGopherLT/VSTR-Bridge/issues)
- **Documentation**: [Full docs](https://github.com/DieGopherLT/vscode-terminal-runner/blob/main/docs/)
- **Show Support**: Star this repository if VSTR-Bridge helps your workflow!

---

**Made for developers who love automation**

Part of the [VSCode Terminal Runner](https://github.com/DieGopherLT/vscode-terminal-runner) ecosystem.
