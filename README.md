# VSTR-Bridge - VSCode Extension

> **Bridge the gap between CLI and VSCode** - Seamlessly execute terminal commands from VSCode Terminal Runner CLI

[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

## What is VSTR-Bridge?

VSTR-Bridge is the **VSCode extension component** of the VSCode Terminal Runner ecosystem. It acts as a communication bridge between the [VSTR CLI tool](https://github.com/DieGopherLT/vscode-terminal-runner) and your VSCode workspace, enabling seamless terminal automation directly within your editor.

**This extension is designed to work with the [VSCode Terminal Runner CLI](https://github.com/DieGopherLT/vscode-terminal-runner)**

## How It Works

1. **Instruction Reception**: The VSTR CLI sends terminal-open instructions to the extension
2. **Terminal Creation**: The extension opens the requested terminals within VSCode
3. **Workspace Integration**: All commands execute in the context of your current workspace

## Getting Started

### Requirements

- **VSCode**: Version 1.74.0 or higher
- **VSTR CLI**: Install from [here](https://github.com/DieGopherLT/vscode-terminal-runner)

### Installation

#### Recommended: Via CLI (Automatic)

```bash
vstr setup  # Automatically installs and configures the extension
```

#### Manual: From GitHub Releases

If the CLI method isn't available, you can install manually:

1. Download the latest `.vsix` file from the [GitHub Releases page](https://github.com/DieGopherLT/VSTR-Bridge/releases)
2. Open VSCode
3. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
4. Click the `...` menu at the top right of the panel and select "Install from VSIX..."
5. Select the downloaded `.vsix` file and click Install

### Verification

To verify the bridge is working:

1. Open VSCode with a workspace
2. Run the command: **"VSTR Bridge: Show Status"** from Command Palette (`Ctrl+Shift+P`)
3. You should see bridge information including port and workspace details

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
