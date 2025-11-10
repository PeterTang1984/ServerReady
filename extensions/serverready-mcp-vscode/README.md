# ServerReady MCP for VS Code / 在 VS Code 中使用 ServerReady MCP

English:
- This extension lets you start and manage the ServerReady MCP server directly inside VS Code, so AI tooling can discover and call ServerReady tools (inspect, quick check, init, analyze deps, auto-config) in chat and command panels.

中文：
- 该扩展允许在 VS Code 中启动和管理 ServerReady MCP 服务器，使 AI 工具可在聊天与命令面板中发现并调用 ServerReady 工具（预检、快速检查、初始化、依赖分析、自动配置）。

## Commands / 命令

- `ServerReady MCP: Start / 启动` (`serverreadyMcp.start`)
- `ServerReady MCP: Stop / 停止` (`serverreadyMcp.stop`)

## Configuration / 配置

Settings (`settings.json`) / 设置（`settings.json`）：
```json
{
  "serverreadyMcp.command": "node",
  "serverreadyMcp.args": ["${workspaceFolder}/src/mcp-server.js"],
  "serverreadyMcp.workingDirectory": "${workspaceFolder}",
  "serverreadyMcp.environment": { "NODE_ENV": "development" }
}
```

## Usage / 使用方法

English:
- Open Command Palette and run `ServerReady MCP: Start`, then use your AI tooling to call MCP tools like `analyze_dependencies`, `check_port`, `initialize_server`.

中文：
- 在命令面板运行 `ServerReady MCP: Start`，随后在 AI 工具中调用 MCP 工具，如 `analyze_dependencies`、`check_port`、`initialize_server`。

## Publish / 发布到 VS Code 市场

English:
- Prerequisites: install `vsce` (`npm i -g vsce`), set `publisher` to your marketplace publisher name in `package.json`.
- Package and publish:
  - `vsce package`
  - `vsce publish`

中文：
- 前置条件：安装 `vsce`（`npm i -g vsce`），在 `package.json` 设置 `publisher` 为你的市场发布者名。
- 打包与发布：
  - `vsce package`
  - `vsce publish`

## License / 许可证

- ISC