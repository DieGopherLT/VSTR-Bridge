# VSTR-Bridge - VSCode Extension

> 🚧 **Work in Progress** - This project is under active development

> **Bridge the gap between CLI and VSCode** - Seamlessly execute terminal commands from VSCode Terminal Runner CLI

> ⚠️ **Windows Support Warning** - Windows support is not fully ready. Currently supported on Linux and macOS only.

[![VSCode Marketplace](https://img.shields.io/badge/VSCode-Marketplace-blue?style=flat-square&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=vstr.bridge)
[![Version](https://img.shields.io/visual-studio-marketplace/v/vstr.bridge?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=vstr.bridge)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/vstr.bridge?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=vstr.bridge)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

## 🎯 What is VSTR-Bridge?

VSTR-Bridge is the **VSCode extension component** of the VSCode Terminal Runner ecosystem. It acts as a communication bridge between the [VSTR CLI tool](https://github.com/DieGopherLT/vscode-terminal-runner) and your VSCode workspace, enabling seamless terminal automation directly within your editor.

**This extension is designed to work with the [VSCode Terminal Runner CLI](https://github.com/DieGopherLT/vscode-terminal-runner)**

## 🔗 How It Works

1. **CLI Command**: You run `vstr workspace run my-project` in your terminal
2. **Bridge Discovery**: CLI automatically detects the active VSCode instance
3. **Terminal Creation**: Extension creates terminals and executes commands within VSCode
4. **Workspace Integration**: All commands run in the context of your current workspace

## ⚡ Key Features

- **🔍 Automatic Discovery**: CLI automatically finds the correct VSCode instance
- **🏃‍♂️ Zero-Configuration**: Works out of the box with any VSCode workspace
- **🔄 Multi-Instance Support**: Handles multiple VSCode windows intelligently
- **🎯 Context-Aware**: Commands execute in the correct workspace directory
- **🛡️ Secure Communication**: Local HTTP server with process validation

## 🚀 Getting Started

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

## 🎮 Commands

| Command | Description |
|---------|-------------|
| `VSTR Bridge: Show Status` | Display bridge connection info |
| `VSTR Bridge: Restart` | Restart the bridge server |

## 🔧 Configuration

The extension works with zero configuration out of the box! No setup required.

Optional customization available through VSCode settings if needed.

## 🚨 Troubleshooting

If you encounter issues, first run `vstr status` to check if the bridge is active, or use the **"VSTR Bridge: Show Status"** command from VSCode's Command Palette (`Ctrl+Shift+P`). For any problems not resolved by these checks, please [open an issue on GitHub](https://github.com/DieGopherLT/VSTR-Bridge/issues).

## 🔗 Related Projects

- **[VSCode Terminal Runner (CLI)](https://github.com/DieGopherLT/vscode-terminal-runner)** - The main CLI tool

## 🔒 Security & Privacy

VSTR-Bridge implements a **zero trust security model** where every request is verified regardless of source. The extension only accepts authenticated requests from verified VSCode terminals through encrypted token-based authentication. All communication happens exclusively on localhost with no external network connections.

The extension uses multi-layered security including command validation to block dangerous operations, rate limiting to prevent abuse, and secure token storage with automatic expiration. All security events are logged for audit purposes, ensuring complete transparency of bridge operations.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by a developer who loves automation**
