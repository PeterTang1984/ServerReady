/*
 * Simple MCP tools test runner
 * - Tests analyzeDependencies and autoConfigureServer without real SSH (mocked initializer)
 */
const path = require('path');
const { MCPServer } = require('../src/mcp-server.js');

async function run() {
  const projectPath = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const env = process.argv[3] || 'dev';

  const mcp = new MCPServer();
  // Mock initializer to avoid real SSH operations
  mcp.initializer = {
    async initialize(connectionConfig, initOptions) {
      return {
        success: true,
        steps: ['mock-initialize'],
        connectionConfig,
        initOptions
      };
    }
  };

  console.log('Running analyzeDependencies...');
  const analyzeResult = await mcp.analyzeDependencies({ projectPath, env });
  console.log(analyzeResult.content[0].text);

  console.log('\nRunning autoConfigureServer (mock initializer)...');
  const autoConfigResult = await mcp.autoConfigureServer({
    host: '127.0.0.1',
    username: 'root',
    password: 'mock',
    port: 22,
    projectPath,
    env
  });
  console.log(autoConfigResult.content[0].text);
}

run().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});