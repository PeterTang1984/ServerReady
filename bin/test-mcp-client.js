const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function main() {
  // 使用 stdio 启动并连接到本项目的 MCP 服务器
  const serverPath = path.join(__dirname, '..', 'src', 'mcp-server.js');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: process.env,
  });

  const client = new Client({ name: 'serverready-mcp-test', version: '1.0.0' });

  try {
    await client.connect(transport);

    // 1) 列出工具
    const tools = await client.listTools();
    console.log('[ListTools]');
    console.log(JSON.stringify(tools, null, 2));

    // 2) 调用一个不依赖 SSH 的工具：check_port
    const portCheck = await client.callTool({
      name: 'check_port',
      arguments: { host: '127.0.0.1', port: 22 },
    });
    console.log('[CallTool: check_port]');
    console.log(JSON.stringify(portCheck, null, 2));

    // 3) 调用依赖分析工具（本地项目目录），用于验证复杂返回结构
    const analysis = await client.callTool({
      name: 'analyze_dependencies',
      arguments: { projectPath: process.cwd() },
    });
    console.log('[CallTool: analyze_dependencies]');
    console.log(JSON.stringify(analysis, null, 2));
  } catch (err) {
    console.error('MCP client test failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    // 确保关闭连接，终止子进程
    try {
      await client.close();
    } catch {}
  }
}

main();