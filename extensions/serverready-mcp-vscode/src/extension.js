const vscode = require('vscode');
const cp = require('child_process');

let mcpProcess = null;

function startServer(context) {
  const config = vscode.workspace.getConfiguration('serverreadyMcp');
  const command = config.get('command') || 'node';
  const args = config.get('args') || [vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath + '/src/mcp-server.js'];
  const cwd = config.get('workingDirectory') || (vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd());
  const env = Object.assign({}, process.env, config.get('environment') || {});

  if (mcpProcess) {
    vscode.window.showInformationMessage('ServerReady MCP is already running / ServerReady MCP 已在运行');
    return;
  }

  const terminal = vscode.window.createTerminal({ name: 'ServerReady MCP' });
  terminal.show(true);
  terminal.sendText(`${command} ${args.map(a => JSON.stringify(a)).join(' ')}`);

  // Also spawn background process to track status
  mcpProcess = cp.spawn(command, args, { cwd, env, shell: false });
  mcpProcess.on('spawn', () => {
    vscode.window.showInformationMessage('ServerReady MCP started / ServerReady MCP 已启动');
  });
  mcpProcess.on('exit', (code) => {
    mcpProcess = null;
    vscode.window.showWarningMessage(`ServerReady MCP exited (code ${code}) / ServerReady MCP 退出（代码 ${code}）`);
  });
  mcpProcess.stderr?.on('data', (data) => {
    const msg = data.toString();
    vscode.window.showWarningMessage(`MCP stderr: ${msg}`);
  });
}

function stopServer() {
  if (!mcpProcess) {
    vscode.window.showInformationMessage('ServerReady MCP is not running / ServerReady MCP 未运行');
    return;
  }
  try {
    mcpProcess.kill();
    vscode.window.showInformationMessage('ServerReady MCP stopped / ServerReady MCP 已停止');
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to stop MCP: ${err.message} / 停止 MCP 失败：${err.message}`);
  } finally {
    mcpProcess = null;
  }
}

function activate(context) {
  const startCmd = vscode.commands.registerCommand('serverreadyMcp.start', () => startServer(context));
  const stopCmd = vscode.commands.registerCommand('serverreadyMcp.stop', () => stopServer());
  context.subscriptions.push(startCmd, stopCmd);
}

function deactivate() {
  if (mcpProcess) {
    try { mcpProcess.kill(); } catch {}
  }
}

module.exports = { activate, deactivate };