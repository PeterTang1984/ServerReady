# ServerReady / 服务器就绪

A practical tool to inspect and initialize servers intelligently, with CLI, HTTP API, and Model Context Protocol (MCP) support. It analyzes your project dependencies and auto-configures servers accordingly.

一个实用的智能服务器预检与初始化工具，支持 CLI、HTTP API 和 MCP（模型上下文协议）。它能分析项目依赖，并据此自动配置服务器。

---

## Overview / 概述

- English: ServerReady helps teams quickly verify remote servers before deployment, perform essential initialization, and align server setup with application stack through automated dependency analysis.
- 中文：ServerReady 帮助团队在部署前快速验证远程服务器，执行关键初始化，并通过自动依赖分析让服务器配置与应用技术栈保持一致。

---

## Bilingual Prompts Policy / 双语提示规范

- English:
  - All user-facing messages are provided in both English and Chinese, including CLI outputs, HTTP API responses, MCP tool results, errors/exceptions, logs, and interactive prompts.
  - Runtime outputs use concise tags `[EN]` and `[ZH]` for clarity and consistency.
  - Documentation uses section labels `English:` and `中文：` as shown throughout this README.
- 中文：
  - 所有面向用户的消息均提供中英双语，包括 CLI 输出、HTTP API 响应、MCP 工具结果、错误/异常、日志以及交互式提示。
  - 运行时输出统一使用简洁标签 `[EN]` 与 `[ZH]`，保持清晰一致。
  - 文档采用 `English:` 与 `中文：` 的分段标注方式，便于阅读与检索。

Format guidelines / 格式规范：
- English:
  - CLI: print two lines with `[EN] ...` then `[ZH] ...`
  - API: include `messages.en` and `messages.zh` in JSON responses
  - MCP: return tool text with bilingual sections or `messages` object
  - Errors: attach `code`, `messages.en`, `messages.zh`, and optional `details`
  - Logs: write bilingual text to `combined.log` with the same tags
- 中文：
  - CLI：输出两行，先 `[EN] ...` 后 `[ZH] ...`
  - API：JSON 响应包含 `messages.en` 与 `messages.zh`
  - MCP：工具返回文本含双语段落或提供 `messages` 对象
  - 错误：包含 `code`、`messages.en`、`messages.zh` 与可选 `details`
  - 日志：以相同标签写入 `combined.log`

Examples / 示例：

CLI outputs / CLI 输出：
```text
[EN] Inspect succeeded: SSH connected, ports open, resources healthy.
[ZH] 预检成功：SSH 连通、端口可用、系统资源健康。

[EN] Error: Failed to connect SSH. Please verify host and credentials.
[ZH] 错误：SSH 连接失败。请检查主机地址与凭证信息。
```

API responses / API 响应：
```json
{
  "ok": true,
  "code": "INSPECT_OK",
  "messages": {
    "en": "Inspection completed successfully.",
    "zh": "预检已成功完成。"
  },
  "data": { "host": "10.0.0.1", "summary": { "ssh": "ok", "ports": [22, 80] } }
}
```

Error payload / 错误载荷：
```json
{
  "ok": false,
  "code": "SSH_CONNECT_FAILED",
  "messages": {
    "en": "Failed to establish SSH connection.",
    "zh": "无法建立 SSH 连接。"
  },
  "details": { "host": "10.0.0.1", "port": 22 }
}
```

MCP tool result / MCP 工具结果：
```json
{
  "tool": "analyze_dependencies",
  "ok": true,
  "messages": {
    "en": "Dependencies analyzed and recommendations generated.",
    "zh": "依赖分析完成并生成配置建议。"
  },
  "result": { "dependencies": ["node", "docker"], "recommendations": ["enable ufw"] }
}
```

Logs / 日志：
```text
2025-01-12T10:00:00.000Z [INFO] [EN] Initialized firewall rules.
2025-01-12T10:00:00.000Z [INFO] [ZH] 防火墙规则已初始化。
```

Interactive prompts / 交互式提示：
```text
[EN] Missing required option: --host. Please provide a target host.
[ZH] 缺少必需参数：--host。请提供目标主机。
```

Consistency / 一致性要求：
- English:
  - Keep dynamic values identical across languages; avoid divergent content.
  - Prefer short, actionable sentences; do not mix multiple actions in one message.
- 中文：
  - 动态值应在两种语言中保持一致，避免内容不一致。
  - 采用简短、可执行的句式；一个消息不应混杂多个操作。

---

## Features / 功能特性

- English:
  - Pre-deployment inspection: network, SSH connectivity, ports, system resources, security
  - Initialization: updates, firewall rules, web server, database, network optimization, security hardening
  - Multi-interface: CLI, HTTP API, MCP Tool
  - Dependency analysis and auto configuration (Node/Python/Java/Go/Ruby/PHP/Docker)
  - Batch operations and quick checks
  - Structured logs and JSON outputs
- 中文：
  - 预部署检查：网络、SSH连通性、端口、系统资源、安全
  - 初始化：系统更新、防火墙、Web服务器、数据库、网络优化、安全加固
  - 多接口：CLI、HTTP API、MCP工具
  - 依赖分析与自动配置（支持 Node/Python/Java/Go/Ruby/PHP/Docker）
  - 批量操作与快速检查
  - 结构化日志与 JSON 输出

---

## Installation / 安装

- English:
  - Requirements: Node.js ≥ 18 (tested on Node 24.x), npm
  - Install dependencies: `npm install`
- 中文：
  - 环境要求：Node.js ≥ 18（已在 Node 24.x 上测试）、npm
  - 安装依赖：`npm install`

---

## Configuration / 配置

- English:
  - Centralized config in `config/config.js`:
    - SSH defaults, network checks, service checks (web/db/ssh), thresholds, and initialization presets
  - Override via CLI flags or API body parameters
- 中文：
  - 统一配置文件：`config/config.js`
    - SSH默认值、网络检查、服务检查（web/db/ssh）、系统阈值、初始化预设
  - 可通过 CLI 参数或 API 请求体覆盖

---

## Quick Start / 快速开始

- English:
  - Start HTTP API: `npm start` (default port `3000`)
  - Run tests: `npm test`
  - MCP local test: `npm run mcp:test`
- 中文：
  - 启动 HTTP API：`npm start`（默认端口 `3000`）
  - 运行测试：`npm test`
  - MCP 本地测试：`npm run mcp:test`

---

## CLI Usage / CLI 使用

- English:
  - Inspect server:
    - `serverready inspect -h <host> -u <username> -p <password> -P 22 --json`
  - Initialize server:
    - `serverready init -h <host> -u <username> -p <password> --web-server nginx --database mysql --json`
  - Quick check:
    - `serverready quick-check -h <host> -u <username> -p <password> --json`
  - Auto-config by local project deps:
    - `serverready auto-config -h <host> -u <username> -p <password> --project . --env prod --json`
- 中文：
  - 服务器预检：
    - `serverready inspect -h <host> -u <username> -p <password> -P 22 --json`
  - 服务器初始化：
    - `serverready init -h <host> -u <username> -p <password> --web-server nginx --database mysql --json`
  - 快速检查：
    - `serverready quick-check -h <host> -u <username> -p <password> --json`
  - 基于本地项目依赖自动配置：
    - `serverready auto-config -h <host> -u <username> -p <password> --project . --env prod --json`

Notes / 备注：
- You can provide `--private-key <path>` instead of `-p <password>`
- 可使用 `--private-key <path>` 替代 `-p <password>`

---

## HTTP API / HTTP 接口

- English:
  - Health: `GET /health`
  - Version: `GET /api/version`
  - Inspect: `POST /api/inspect`
  - Initialize: `POST /api/init`
  - Quick check: `POST /api/quick-check`
  - Config dump: `GET /api/config`
  - Batch ops: `POST /api/batch` (operation: `inspect` or `init`)
  - Port check: `POST /api/check-port`
  - Dependency analyze: `POST /api/deps/analyze`
  - Auto-config (by deps): `POST /api/deps/auto-config`
- 中文：
  - 健康检查：`GET /health`
  - 版本信息：`GET /api/version`
  - 服务器预检：`POST /api/inspect`
  - 服务器初始化：`POST /api/init`
  - 快速检查：`POST /api/quick-check`
  - 配置输出：`GET /api/config`
  - 批量操作：`POST /api/batch`（operation：`inspect` 或 `init`）
  - 端口检查：`POST /api/check-port`
  - 依赖分析：`POST /api/deps/analyze`
  - 基于依赖的自动配置：`POST /api/deps/auto-config`

Examples / 示例：
```bash
# Inspect / 预检
curl -X POST http://localhost:3000/api/inspect \
  -H "Content-Type: application/json" \
  -d '{"host":"<ip>","username":"root","password":"<pwd>","port":22}'

# Init / 初始化
curl -X POST http://localhost:3000/api/init \
  -H "Content-Type: application/json" \
  -d '{"host":"<ip>","username":"root","password":"<pwd>","webServer":"nginx","database":"mysql"}'

# Analyze deps / 分析依赖
curl -X POST http://localhost:3000/api/deps/analyze \
  -H "Content-Type: application/json" \
  -d '{"projectPath":".","env":"dev"}'

# Auto-config by deps / 基于依赖自动配置
curl -X POST http://localhost:3000/api/deps/auto-config \
  -H "Content-Type: application/json" \
  -d '{"host":"<ip>","username":"root","password":"<pwd>","projectPath":".","env":"prod"}'
```

---

## MCP Tool / MCP 工具

- English:
  - Start MCP server (stdio): `node src/mcp-server.js`
  - Local MCP test: `npm run mcp:test` (uses `bin/test-mcp-client.js`)
  - Tools:
    - `inspect_server`, `quick_check`, `initialize_server`, `check_port`, `get_system_info`
    - `batch_inspect`, `analyze_dependencies`, `auto_configure_server`
- 中文：
  - 启动 MCP（stdio）：`node src/mcp-server.js`
  - 本地测试：`npm run mcp:test`（使用 `bin/test-mcp-client.js`）
  - 工具列表：
    - `inspect_server`、`quick_check`、`initialize_server`、`check_port`、`get_system_info`
    - `batch_inspect`、`analyze_dependencies`、`auto_configure_server`

MCP usage examples / MCP 使用示例：
```bash
# List tools / 列出工具
npm run mcp:test -- --list

# Analyze deps / 分析依赖
npm run mcp:test -- --call analyze_dependencies --args '{"projectPath":".","env":"dev"}'

# Auto-config / 自动配置
npm run mcp:test -- --call auto_configure_server --args '{"host":"<ip>","username":"root","password":"<pwd>","projectPath":".","env":"prod"}'
```

---

## Dependency Analysis & Auto Config / 依赖分析与自动配置

- English:
  - Detects runtime, frameworks, databases, caches, queues, build/test tools, docker; evaluates health and scans common security issues; generates server recommendations by environment (`dev/test/prod`).
- 中文：
  - 检测运行时、框架、数据库、缓存、消息队列、构建/测试工具、Docker；评估项目健康并扫描常见安全问题；按环境（`dev/test/prod`）生成服务器配置建议。

Outputs include / 输出内容包含：
- `dependencies`, `recommendations`, `health`, `securityIssues`, `timestamp`

---

## Logs / 日志

- English:
  - Logs are written to `logs/combined.log` and `logs/error.log`
- 中文：
  - 日志输出到 `logs/combined.log` 和 `logs/error.log`

---

## Testing & Lint / 测试与代码规范

- English:
  - Run tests: `npm test`
  - Coverage: `npm run test:coverage`
  - MCP test: `npm run mcp:test`
  - Lint: `npm run lint`, fix: `npm run lint:fix`
- 中文：
  - 运行测试：`npm test`
  - 覆盖率：`npm run test:coverage`
  - MCP 测试：`npm run mcp:test`
  - Lint：`npm run lint`，自动修复：`npm run lint:fix`

---

## Security Notes / 安全说明

- English:
  - Avoid storing credentials in plain text; prefer `--private-key`
  - Use `env=prod` for stricter security hardening
- 中文：
  - 避免明文保存凭证，尽量使用 `--private-key`
  - 生产环境设置 `env=prod` 开启更严格的安全加固

---

## Contributing / 参与贡献

- English:
  - Issues and PRs are welcome. Please run `npm test` before submitting.
- 中文：
  - 欢迎提交问题和 PR。提交前请运行 `npm test`。

---

## License / 许可证

- English: ISC License
- 中文：ISC 许可证