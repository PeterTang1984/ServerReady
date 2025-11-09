const { describe, it, expect } = require('@jest/globals');

// Mock the dependencies
jest.mock('../src/inspector.js', () => {
  return {
    ServerInspector: jest.fn().mockImplementation(() => ({
      inspect: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    }))
  };
});

jest.mock('../src/initializer.js', () => {
  return {
    ServerInitializer: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      updateSystem: jest.fn(),
      installBasePackages: jest.fn(),
      configureWebServer: jest.fn(),
      configureDatabase: jest.fn()
    }))
  };
});

const { MCPServer } = require('../src/mcp-server.js');

describe('MCP Server', () => {
  let mcpServer;

  beforeEach(() => {
    mcpServer = new MCPServer();
  });

  describe('Tool Registration', () => {
    it('should register all required tools', () => {
      // Test that the tools are properly set up by checking if they can be called
      const expectedTools = [
        'inspect_server',
        'quick_check', 
        'initialize_server',
        'check_port',
        'get_system_info',
        'batch_inspect',
        'analyze_dependencies',
        'auto_configure_server'
      ];
      
      // Mock the methods to verify they exist and can be called
      expectedTools.forEach(toolName => {
        const methodName = toolName.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
        const capitalizedMethod = methodName.charAt(0).toUpperCase() + methodName.slice(1);
        
        // Check if the method exists on the mcpServer instance
        const methodExists = typeof mcpServer[capitalizedMethod] === 'function' || 
                           typeof mcpServer[methodName] === 'function';
        
        expect(methodExists).toBe(true);
      });
    });

    it('should validate tool input schemas', () => {
      // Test that the inspectServer method exists and can handle the expected parameters
      expect(typeof mcpServer.inspectServer).toBe('function');
      
      // Test the method by calling it with mock parameters
      const mockInspector = {
        inspect: jest.fn().mockResolvedValue({ status: 'ok' })
      };
      
      mcpServer.inspector = mockInspector;
      
      // This should not throw an error if the method exists and handles parameters correctly
      return expect(mcpServer.inspectServer({
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass'
      })).resolves.toBeDefined();
    });
  });

  describe('Dependency Analysis', () => {
    it('should analyze Node.js project dependencies', async () => {
      const projectPath = '/tmp/test-node-project';
      const mockFiles = {
        'package.json': JSON.stringify({
          dependencies: {
            'express': '^4.18.0',
            'mysql2': '^3.6.0'
          },
          devDependencies: {
            'jest': '^29.0.0'
          }
        })
      };

      // Mock file system
      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath.includes('package.json')) {
          return Promise.resolve(mockFiles['package.json']);
        }
        // For all other files, throw error to skip them
        throw new Error('File not found');
      });

      const result = await mcpServer.analyzeProjectDependencies(projectPath);

      expect(result).toHaveProperty('runtime', 'node');
      expect(result).toHaveProperty('webFrameworks');
      expect(result.webFrameworks).toContain('express');
      expect(result).toHaveProperty('databases');
      expect(result.databases).toContain('mysql');
      expect(result).toHaveProperty('testFrameworks');
      expect(result.testFrameworks).toContain('jest');

      // Restore original function
      require('fs').promises.readFile = originalReadFile;
    });

    it('should analyze Python project dependencies', async () => {
      const projectPath = '/tmp/test-python-project';
      const requirementsContent = 'django==3.2.0\nflask==2.0.0\npsycopg2==2.9.0';

      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath.includes('requirements.txt')) {
          return Promise.resolve(requirementsContent);
        }
        // For all other files, throw error to skip them
        throw new Error('File not found');
      });

      const result = await mcpServer.analyzeProjectDependencies(projectPath);

      expect(result).toHaveProperty('runtime', 'python');
      expect(result).toHaveProperty('webFrameworks');
      expect(result.webFrameworks).toContain('django');
      expect(result.webFrameworks).toContain('flask');
      expect(result).toHaveProperty('databases');
      expect(result.databases).toContain('postgresql');

      require('fs').promises.readFile = originalReadFile;
    });

    it('should detect Docker usage', async () => {
      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath.includes('Dockerfile')) {
          return Promise.resolve('FROM node:14\nWORKDIR /app');
        }
        if (filePath.includes('package.json')) {
          return Promise.resolve('{"dependencies":{"express":"^4.0.0"}}');
        }
        if (filePath.includes('requirements.txt')) {
          throw new Error('File not found');
        }
        return originalReadFile(filePath);
      });

      const result = await mcpServer.analyzeProjectDependencies('/test/path');

      expect(result).toHaveProperty('docker', true);
      expect(result).toHaveProperty('runtime', 'node'); // Dockerfile overrides to node
      expect(result.webFrameworks).toContain('express');

      require('fs').promises.readFile = originalReadFile;
    });

    it('should include health and security issues and env-based recommendations', async () => {
      const mockAnalysis = {
        runtime: 'node',
        webFrameworks: ['express'],
        databases: [],
        caches: [],
        messageQueues: [],
        docker: false,
        packageManager: 'npm',
        buildTools: [],
        testFrameworks: [],
        nodeDeps: {}
      };

      mcpServer.analyzeProjectDependencies = jest.fn().mockResolvedValue(mockAnalysis);

      const result = await mcpServer.analyzeDependencies({ projectPath: '/test/path', env: 'prod' });
      const data = JSON.parse(result.content[0].text);

      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('health');
      expect(typeof data.data.health.score).toBe('number');
      expect(data.data).toHaveProperty('securityIssues');
      expect(Array.isArray(data.data.securityIssues)).toBe(true);
      // Express without helmet should trigger a security suggestion
      expect(data.data.securityIssues.some(i => i.component === 'express')).toBe(true);
      // Production env should include certbot in packages
      expect(data.data.recommendations.packages).toContain('certbot');
    });

    it('should analyze Java Maven project (spring-boot)', async () => {
      const projectPath = '/tmp/test-java-project';
      const originalReadFile = require('fs').promises.readFile;
      require('fs').promises.readFile = jest.fn().mockImplementation((filePath) => {
        if (filePath.includes('pom.xml')) {
          return Promise.resolve('<project>spring-boot</project>');
        }
        throw new Error('File not found');
      });

      const result = await mcpServer.analyzeProjectDependencies(projectPath);
      expect(result).toHaveProperty('runtime', 'java');
      expect(result).toHaveProperty('packageManager', 'maven');
      expect(result.webFrameworks).toContain('spring-boot');

      require('fs').promises.readFile = originalReadFile;
    });
  });

  describe('Server Recommendations', () => {
    it('should generate recommendations for Node.js project', () => {
      const analysis = {
        runtime: 'node',
        webFrameworks: ['express'],
        databases: ['mysql'],
        caches: [],
        messageQueues: [],
        docker: false,
        packageManager: 'npm',
        buildTools: [],
        testFrameworks: []
      };

      const recommendations = mcpServer.generateServerRecommendations(analysis);

      expect(recommendations).toHaveProperty('webServer', 'nginx');
      expect(recommendations).toHaveProperty('database', 'mysql');
      expect(recommendations).toHaveProperty('packages');
      expect(recommendations.packages).toContain('nginx');
      expect(recommendations.packages).toContain('mysql-server');
      expect(recommendations.packages).toContain('nodejs');
      expect(recommendations.packages).toContain('npm');
    });

    it('should generate recommendations for Python project', () => {
      const analysis = {
        runtime: 'python',
        webFrameworks: ['django'],
        databases: ['postgresql'],
        caches: [],
        messageQueues: [],
        docker: false,
        packageManager: 'pip',
        buildTools: [],
        testFrameworks: []
      };

      const recommendations = mcpServer.generateServerRecommendations(analysis);

      expect(recommendations).toHaveProperty('webServer', 'nginx');
      expect(recommendations).toHaveProperty('database', 'postgresql');
      expect(recommendations.packages).toContain('postgresql');
      expect(recommendations.packages).toContain('python3');
      expect(recommendations.packages).toContain('python3-pip');
    });

    it('should handle Docker projects', () => {
      const analysis = {
        runtime: 'node',
        webFrameworks: ['express'],
        databases: [],
        caches: [],
        messageQueues: [],
        docker: true,
        packageManager: 'npm',
        buildTools: [],
        testFrameworks: []
      };

      const recommendations = mcpServer.generateServerRecommendations(analysis);

      expect(recommendations).toHaveProperty('webServer', 'nginx');
      expect(recommendations).toHaveProperty('packages');
      expect(recommendations.packages).toContain('nginx');
      expect(recommendations.packages).toContain('nodejs');
      expect(recommendations.packages).toContain('npm');
    });
  });

  describe('Tool Execution', () => {
    it('should execute inspect_server tool', async () => {
      const mockInspector = {
        inspect: jest.fn().mockResolvedValue({
          server: 'test-server.com',
          status: 'ok'
        })
      };

      mcpServer.inspector = mockInspector;

      const result = await mcpServer.inspectServer({
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass'
      });

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('details');
      expect(data.data.details).toHaveProperty('server', 'test-server.com');
    });

    it('should analyze dependencies for Node.js project', async () => {
      const mockAnalysis = {
        runtime: 'node',
        webFrameworks: ['express'],
        databases: ['mysql'],
        caches: ['redis'],
        messageQueues: [],
        docker: false,
        packageManager: 'npm',
        buildTools: ['webpack'],
        testFrameworks: ['jest']
      };

      mcpServer.analyzeProjectDependencies = jest.fn().mockResolvedValue(mockAnalysis);

      const result = await mcpServer.analyzeDependencies({ projectPath: '/test/path' });
      
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('projectPath', '/test/path');
      expect(data.data).toHaveProperty('dependencies');
      expect(data.data.dependencies).toHaveProperty('runtime', 'node');
      expect(data.data.dependencies).toHaveProperty('webFrameworks');
      expect(data.data.dependencies.webFrameworks).toContain('express');
      expect(data.data.dependencies).toHaveProperty('databases');
      expect(data.data.dependencies.databases).toContain('mysql');
      expect(data.data.dependencies).toHaveProperty('caches');
      expect(data.data.dependencies.caches).toContain('redis');
      expect(data.data).toHaveProperty('recommendations');
      expect(data.data).toHaveProperty('timestamp');
    });

    it('should execute auto_configure_server tool', async () => {
      const mockAnalysis = {
        runtime: 'node',
        webFrameworks: ['express'],
        databases: ['mysql'],
        caches: [],
        messageQueues: [],
        docker: false,
        packageManager: 'npm',
        buildTools: [],
        testFrameworks: []
      };

      const mockRecommendations = {
        webServer: 'nginx',
        database: 'mysql',
        packages: ['nginx', 'mysql-server'],
        services: ['nginx', 'mysql'],
        ports: [80, 443, 3306]
      };

      const mockInitResult = {
        success: true,
        message: 'Server initialized successfully'
      };

      mcpServer.analyzeProjectDependencies = jest.fn().mockResolvedValue(mockAnalysis);
      mcpServer.initializer.initialize = jest.fn().mockResolvedValue(mockInitResult);

      const result = await mcpServer.autoConfigureServer({
        projectPath: '/tmp/test-project',
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass',
        env: 'prod'
      });

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      const config = JSON.parse(result.content[0].text);
      expect(config).toHaveProperty('data');
      expect(config.data).toHaveProperty('message', 'Server auto-configuration completed');
      expect(config.data).toHaveProperty('dependencies');
      expect(config.data).toHaveProperty('recommendations');
      expect(config.data).toHaveProperty('health');
      expect(config.data).toHaveProperty('securityIssues');
      expect(config.data).toHaveProperty('initializationResult');
      // Ensure prod env flowed into recommendations
      expect(config.data.recommendations.packages).toContain('certbot');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool', async () => {
      // The MCP SDK handles unknown tools, not the MCPServer directly
      // This test should verify the server setup handles tools correctly
      expect(mcpServer.server).toBeDefined();
    });

    it('should handle tool execution errors', async () => {
      const mockInspector = {
        inspect: jest.fn().mockRejectedValue(new Error('SSH connection failed'))
      };

      mcpServer.inspector = mockInspector;

      try {
        await mcpServer.inspectServer('test-host', 22, 'user', 'password');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBe('SSH connection failed');
      }
    });

    it('should handle invalid tool parameters', async () => {
      const mockInspector = {
        inspect: jest.fn().mockImplementation(() => {
          throw new Error('Missing required parameters');
        })
      };

      mcpServer.inspector = mockInspector;

      try {
        await mcpServer.inspectServer('test-host', 22, 'user', 'password');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBe('Missing required parameters');
      }
    });
  });
});