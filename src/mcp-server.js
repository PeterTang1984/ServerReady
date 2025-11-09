const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
// 兼容默认导出与命名导出（以便通过 Jest 的命名导出 mock）
const InspectorModule = require('./inspector.js');
const InitializerModule = require('./initializer.js');
const ServerInspector = InspectorModule.ServerInspector || InspectorModule;
const ServerInitializer = InitializerModule.ServerInitializer || InitializerModule;
const fs = require('fs').promises;
const path = require('path');

class MCPServer {
  constructor() {
    // 错误处理配置
    this.errorConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      errorCodes: {
        SSH_CONNECTION_FAILED: 'SSH_CONNECTION_FAILED',
        AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
        TIMEOUT: 'TIMEOUT',
        PERMISSION_DENIED: 'PERMISSION_DENIED',
        NETWORK_ERROR: 'NETWORK_ERROR',
        VALIDATION_ERROR: 'VALIDATION_ERROR',
        INTERNAL_ERROR: 'INTERNAL_ERROR'
      }
    };

    this.server = new Server(
      {
        name: 'serverready-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.inspector = new ServerInspector();
    this.initializer = new ServerInitializer();
    this.setupTools();
  }

  // 双语消息辅助
  createMessages(en, zh) {
    return { en, zh };
  }

  // 错误处理中心方法
  handleError(error, toolName) {
    const errorInfo = this.classifyError(error);
    const errorResponse = {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
        details: errorInfo.details,
        timestamp: new Date().toISOString(),
        tool: toolName,
        suggestion: errorInfo.suggestion
      },
      messages: this.createMessages('Tool execution failed.', '工具执行失败。')
    };

    // 记录错误日志
    console.error(`[${toolName}] Error:`, errorResponse);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(errorResponse, null, 2)
      }]
    };
  }

  // 错误分类和详细信息
  classifyError(error) {
    const errorMessage = error.message || error.toString();
    
    // SSH连接错误
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')) {
      return {
        code: this.errorConfig.errorCodes.SSH_CONNECTION_FAILED,
        message: 'SSH连接失败',
        details: errorMessage,
        suggestion: '请检查服务器地址、端口是否正确，确保SSH服务已启动'
      };
    }
    
    // 认证错误
    if (errorMessage.includes('Authentication failed') || errorMessage.includes('Permission denied')) {
      return {
        code: this.errorConfig.errorCodes.AUTHENTICATION_FAILED,
        message: '认证失败',
        details: errorMessage,
        suggestion: '请检查用户名和密码是否正确，或尝试使用SSH密钥认证'
      };
    }
    
    // 超时错误
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return {
        code: this.errorConfig.errorCodes.TIMEOUT,
        message: '操作超时',
        details: errorMessage,
        suggestion: '请检查网络连接，或增加超时时间设置'
      };
    }
    
    // 权限错误
    if (errorMessage.includes('EACCES') || errorMessage.includes('insufficient privileges')) {
      return {
        code: this.errorConfig.errorCodes.PERMISSION_DENIED,
        message: '权限不足',
        details: errorMessage,
        suggestion: '请使用具有足够权限的用户，或联系系统管理员'
      };
    }
    
    // 网络错误
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('network')) {
      return {
        code: this.errorConfig.errorCodes.NETWORK_ERROR,
        message: '网络错误',
        details: errorMessage,
        suggestion: '请检查网络连接和DNS设置'
      };
    }
    
    // 验证错误
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return {
        code: this.errorConfig.errorCodes.VALIDATION_ERROR,
        message: '参数验证失败',
        details: errorMessage,
        suggestion: '请检查输入参数是否符合要求'
      };
    }
    
    // 默认内部错误
    return {
      code: this.errorConfig.errorCodes.INTERNAL_ERROR,
      message: '内部错误',
      details: errorMessage,
      suggestion: '请稍后重试，或联系技术支持'
    };
  }

  // 带重试机制的异步执行
  async executeWithRetry(asyncFn, retries = this.errorConfig.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await Promise.race([
          asyncFn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), this.errorConfig.timeout)
          )
        ]);
      } catch (error) {
        lastError = error;
        
        // 如果是不可重试的错误，直接抛出
        const errorInfo = this.classifyError(error);
        if (errorInfo.code === this.errorConfig.errorCodes.AUTHENTICATION_FAILED ||
            errorInfo.code === this.errorConfig.errorCodes.PERMISSION_DENIED ||
            errorInfo.code === this.errorConfig.errorCodes.VALIDATION_ERROR) {
          throw error;
        }
        
        // 最后一次尝试失败，抛出错误
        if (attempt === retries) {
          throw error;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, this.errorConfig.retryDelay * attempt));
      }
    }
    
    throw lastError;
  }

  // 创建成功响应
  createSuccessResponse(toolName, data, enMessage = 'Operation completed successfully.', zhMessage = '操作已成功完成。') {
    const response = {
      success: true,
      tool: toolName,
      messages: this.createMessages(enMessage, zhMessage),
      data: data,
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        executionTime: Number(process.hrtime.bigint()) // 转换为数字以避免BigInt序列化问题
      }
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };
  }

  // 创建进度响应
  createProgressResponse(toolName, progress, message, details = {}) {
    const response = {
      success: true,
      tool: toolName,
      type: 'progress',
      progress: {
        percentage: progress,
        message: message,
        details: details
      },
      timestamp: new Date().toISOString()
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };
  }

  setupTools() {
    // 服务器检查工具
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'inspect_server':
            return await this.inspectServer(args);
          case 'quick_check':
            return await this.quickCheck(args);
          case 'initialize_server':
            return await this.initializeServer(args);
          case 'check_port':
            return await this.checkPort(args);
          case 'get_system_info':
            return await this.getSystemInfo(args);
          case 'batch_inspect':
            return await this.batchInspect(args);
          case 'analyze_dependencies':
            return await this.analyzeDependencies(args);
          case 'auto_configure_server':
            return await this.autoConfigureServer(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.handleError(error, name);
      }
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'inspect_server',
            description: '对服务器进行全面的预检查，包括网络连通性、服务状态、系统资源等',
            inputSchema: {
              type: 'object',
              properties: {
                host: { type: 'string', description: '服务器地址' },
                username: { type: 'string', description: 'SSH用户名' },
                password: { type: 'string', description: 'SSH密码' },
                port: { type: 'number', description: 'SSH端口，默认22' }
              },
              required: ['host', 'username', 'password']
            }
          },
          {
            name: 'quick_check',
            description: '快速检查服务器的基本状态',
            inputSchema: {
              type: 'object',
              properties: {
                host: { type: 'string', description: '服务器地址' },
                username: { type: 'string', description: 'SSH用户名' },
                password: { type: 'string', description: 'SSH密码' },
                port: { type: 'number', description: 'SSH端口，默认22' }
              },
              required: ['host', 'username', 'password']
            }
          },
          {
            name: 'initialize_server',
            description: '初始化服务器，安装必要的软件和服务',
            inputSchema: {
              type: 'object',
              properties: {
                host: { type: 'string', description: '服务器地址' },
                username: { type: 'string', description: 'SSH用户名' },
                password: { type: 'string', description: 'SSH密码' },
                port: { type: 'number', description: 'SSH端口，默认22' },
                config: { type: 'object', description: '初始化配置选项' }
              },
              required: ['host', 'username', 'password']
            }
          },
          {
            name: 'check_port',
            description: '检查特定端口是否开放',
            inputSchema: {
              type: 'object',
              properties: {
                host: { type: 'string', description: '服务器地址' },
                port: { type: 'number', description: '要检查的端口号' }
              },
              required: ['host', 'port']
            }
          },
          {
            name: 'get_system_info',
            description: '获取服务器系统信息',
            inputSchema: {
              type: 'object',
              properties: {
                host: { type: 'string', description: '服务器地址' },
                username: { type: 'string', description: 'SSH用户名' },
                password: { type: 'string', description: 'SSH密码' },
                port: { type: 'number', description: 'SSH端口，默认22' }
              },
              required: ['host', 'username', 'password']
            }
          },
          {
            name: 'batch_inspect',
            description: '批量检查多个服务器',
            inputSchema: {
              type: 'object',
              properties: {
                servers: { 
                  type: 'array', 
                  description: '服务器列表',
                  items: {
                    type: 'object',
                    properties: {
                      host: { type: 'string' },
                      username: { type: 'string' },
                      password: { type: 'string' },
                      port: { type: 'number' }
                    },
                    required: ['host', 'username', 'password']
                  }
                }
              },
              required: ['servers']
            }
          },
          {
            name: 'analyze_dependencies',
            description: '分析项目依赖并生成服务器配置需求',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: { type: 'string', description: '项目路径，默认为当前目录' },
                packageJsonPath: { type: 'string', description: 'package.json路径' },
                requirementsPath: { type: 'string', description: 'requirements.txt路径' },
                dockerfilePath: { type: 'string', description: 'Dockerfile路径' },
                env: { type: 'string', description: '环境标识（dev/test/prod）', enum: ['dev','test','prod'] }
              }
            }
          },
          {
            name: 'auto_configure_server',
            description: '根据项目依赖自动配置服务器',
            inputSchema: {
              type: 'object',
              properties: {
                host: { type: 'string', description: '服务器地址' },
                username: { type: 'string', description: 'SSH用户名' },
                password: { type: 'string', description: 'SSH密码' },
                port: { type: 'number', description: 'SSH端口，默认22' },
                projectPath: { type: 'string', description: '项目路径，默认为当前目录' },
                stack: { type: 'string', description: '技术栈类型 (node, python, java, go, ruby, php, docker)' },
                env: { type: 'string', description: '环境标识（dev/test/prod）', enum: ['dev','test','prod'] }
              },
              required: ['host', 'username', 'password']
            }
          }
        ]
      };
    });
  }

  async inspectServer(args) {
    try {
      const result = await this.executeWithRetry(async () => {
        return await this.inspector.inspect(args);
      });
      
      return this.createSuccessResponse('inspect_server', {
        status: 'completed',
        summary: `服务器 ${args.host} 检查完成`,
        details: result,
        timestamp: new Date().toISOString()
      }, 'Server inspection completed.', '服务器预检完成。');
    } catch (error) {
      throw error;
    }
  }

  async quickCheck(args) {
    try {
      const result = await this.executeWithRetry(async () => {
        return await this.inspector.quickCheck(args);
      });
      
      return this.createSuccessResponse('quick_check', {
        status: 'completed',
        summary: `服务器 ${args.host} 快速检查完成`,
        details: result,
        timestamp: new Date().toISOString()
      }, 'Quick check completed.', '快速检查完成。');
    } catch (error) {
      throw error;
    }
  }

  async initializeServer(args) {
    try {
      const result = await this.executeWithRetry(async () => {
        return await this.initializer.initialize(args);
      });
      
      return this.createSuccessResponse('initialize_server', {
        status: 'completed',
        summary: `服务器 ${args.host} 初始化完成`,
        details: result,
        timestamp: new Date().toISOString()
      }, 'Server initialization completed.', '服务器初始化完成。');
    } catch (error) {
      throw error;
    }
  }

  async checkPort(args) {
    try {
      const { host, port } = args;
      const isOpen = await this.executeWithRetry(async () => {
        return await this.inspector.checkPort(host, port);
      });
      
      return this.createSuccessResponse('check_port', {
        status: 'completed',
        summary: `端口检查完成`,
        details: {
          host,
          port,
          isOpen,
          status: isOpen ? 'open' : 'closed'
        },
        timestamp: new Date().toISOString()
      }, 'Port check completed.', '端口检查完成。');
    } catch (error) {
      throw error;
    }
  }

  async getSystemInfo(args) {
    try {
      const info = await this.executeWithRetry(async () => {
        return await this.inspector.getSystemInfo(args);
      });
      
      return this.createSuccessResponse('get_system_info', {
        status: 'completed',
        summary: `系统信息获取完成`,
        details: info,
        timestamp: new Date().toISOString()
      }, 'System information retrieved.', '系统信息获取完成。');
    } catch (error) {
      throw error;
    }
  }

  async batchInspect(args) {
    try {
      const results = [];
      const totalServers = args.servers.length;
      
      // 发送开始进度
      console.error(`[EN] [batch_inspect] Starting batch inspection for ${totalServers} servers`);
      console.error(`[ZH] [batch_inspect] 开始批量检查 ${totalServers} 台服务器`);
      
      for (let i = 0; i < args.servers.length; i++) {
        const server = args.servers[i];
        const progress = Math.round(((i + 1) / totalServers) * 100);
        
        // 发送进度更新到stderr，IDE可以捕获
        console.error(`[EN] [batch_inspect] Progress: ${progress}% - Inspecting ${server.host}`);
        console.error(`[ZH] [batch_inspect] 进度: ${progress}% - 检查服务器 ${server.host}`);
        
        try {
          const result = await this.executeWithRetry(async () => {
            return await this.inspector.inspect(server);
          });
          results.push({ 
            server: server.host, 
            status: 'success', 
            result,
            progress
          });
        } catch (error) {
          results.push({ 
            server: server.host, 
            status: 'error', 
            error: error.message,
            progress
          });
        }
      }
      
      console.error(`[EN] [batch_inspect] Batch inspection completed`);
      console.error(`[ZH] [batch_inspect] 批量检查完成`);
      
      return this.createSuccessResponse('batch_inspect', {
        status: 'completed',
        summary: `批量检查完成，共检查 ${totalServers} 台服务器`,
        details: {
          total: totalServers,
          successful: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'error').length,
          results
        },
        timestamp: new Date().toISOString()
      }, 'Batch inspection completed.', '批量检查完成。');
    } catch (error) {
      console.error(`[EN] [batch_inspect] Batch inspection failed: ${error.message}`);
      console.error(`[ZH] [batch_inspect] 批量检查失败: ${error.message}`);
      throw error;
    }
  }

  async analyzeDependencies(args) {
    try {
      const projectPath = args.projectPath || process.cwd();
      const env = args.env || 'dev';
      
      const dependencies = await this.executeWithRetry(async () => {
        return await this.analyzeProjectDependencies(projectPath);
      });
      
      const health = this.evaluateProjectHealth(dependencies);
      const securityIssues = this.scanSecurityIssues(dependencies);
      const recommendations = this.generateServerRecommendations(dependencies, env);
      
      return this.createSuccessResponse('analyze_dependencies', {
        status: 'completed',
        summary: `项目依赖分析完成`,
        projectPath,
        dependencies,
        recommendations,
        health,
        securityIssues,
        timestamp: new Date().toISOString()
      }, 'Dependency analysis completed.', '项目依赖分析完成。');
    } catch (error) {
      throw error;
    }
  }

  async autoConfigureServer(args) {
    try {
      const projectPath = args.projectPath || process.cwd();
      const env = args.env || 'dev';
      
      console.error(`[EN] [auto_configure_server] Starting server auto configuration ${args.host}`);
      console.error(`[ZH] [auto_configure_server] 开始自动配置服务器 ${args.host}`);
      
      // 分析项目依赖
      console.error(`[EN] [auto_configure_server] Analyzing project dependencies...`);
      console.error(`[ZH] [auto_configure_server] 分析项目依赖...`);
      const dependencies = await this.executeWithRetry(async () => {
        return await this.analyzeProjectDependencies(projectPath);
      });
      console.error(`[EN] [auto_configure_server] Detected runtime: ${dependencies.runtime}`);
      console.error(`[ZH] [auto_configure_server] 检测到技术栈: ${dependencies.runtime}`);
      
      const recommendations = this.generateServerRecommendations(dependencies, env);
      const health = this.evaluateProjectHealth(dependencies);
      const securityIssues = this.scanSecurityIssues(dependencies);
      
      console.error(`[EN] [auto_configure_server] Generating configuration recommendations...`);
      console.error(`[ZH] [auto_configure_server] 生成配置建议:`, {
        webServer: recommendations.webServer,
        database: recommendations.database,
        packages: recommendations.packages.length
      });
      
      // 根据推荐配置初始化服务器
      const initConfig = {
        installNodejs: dependencies.runtime === 'node',
        installPython: dependencies.runtime === 'python',
        installJava: dependencies.runtime === 'java',
        installGo: dependencies.runtime === 'go',
        installRuby: dependencies.runtime === 'ruby',
        installPhp: dependencies.runtime === 'php',
        installDocker: dependencies.docker,
        webServer: recommendations.webServer,
        database: recommendations.database,
        additionalPackages: recommendations.packages,
        environment: env,
        securityHardening: env === 'prod'
      };

      console.error(`[EN] [auto_configure_server] Initializing server...`);
      console.error(`[ZH] [auto_configure_server] 开始初始化服务器...`);
      const result = await this.executeWithRetry(async () => {
        return await this.initializer.initialize({
          ...args,
          config: initConfig
        });
      });
      
      console.error(`[EN] [auto_configure_server] Server auto configuration completed`);
      console.error(`[ZH] [auto_configure_server] 服务器自动配置完成`);

      return this.createSuccessResponse('auto_configure_server', {
        status: 'completed',
        summary: `服务器自动配置完成`,
        message: 'Server auto-configuration completed',
        dependencies,
        recommendations,
        health,
        securityIssues,
        initializationResult: result,
        timestamp: new Date().toISOString()
      }, 'Server auto configuration completed.', '服务器自动配置完成。');
    } catch (error) {
      console.error(`[EN] [auto_configure_server] Auto configuration failed: ${error.message}`);
      console.error(`[ZH] [auto_configure_server] 自动配置失败: ${error.message}`);
      throw error;
    }
  }

  async analyzeProjectDependencies(projectPath) {
    const dependencies = {
      runtime: 'unknown',
      webFrameworks: [],
      databases: [],
      caches: [],
      messageQueues: [],
      docker: false,
      packageManager: 'unknown',
      buildTools: [],
      testFrameworks: []
    };

    try {
      // 分析 package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      dependencies.runtime = 'node';
      dependencies.packageManager = 'npm';
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // 检测 Web 框架
      if (allDeps.express) dependencies.webFrameworks.push('express');
      if (allDeps.koa) dependencies.webFrameworks.push('koa');
      if (allDeps.fastify) dependencies.webFrameworks.push('fastify');
      if (allDeps.nest) dependencies.webFrameworks.push('nestjs');
      if (allDeps.next) dependencies.webFrameworks.push('nextjs');
      if (allDeps.nuxt) dependencies.webFrameworks.push('nuxtjs');

      // 检测数据库
      if (allDeps.mysql || allDeps.mysql2) dependencies.databases.push('mysql');
      if (allDeps.pg) dependencies.databases.push('postgresql');
      if (allDeps.mongodb || allDeps.mongoose) dependencies.databases.push('mongodb');
      if (allDeps.redis) dependencies.caches.push('redis');

      // 检测消息队列
      if (allDeps.amqplib) dependencies.messageQueues.push('rabbitmq');
      if (allDeps.bull || allDeps.bullmq) dependencies.messageQueues.push('redis-bull');

      // 检测构建工具
      if (allDeps.webpack) dependencies.buildTools.push('webpack');
      if (allDeps.vite) dependencies.buildTools.push('vite');
      if (allDeps.tsc) dependencies.buildTools.push('typescript');

      // 检测测试框架
      if (allDeps.jest) dependencies.testFrameworks.push('jest');
      if (allDeps.mocha) dependencies.testFrameworks.push('mocha');
      if (allDeps.vitest) dependencies.testFrameworks.push('vitest');

      // 记录 Node 全量依赖，便于安全扫描
      dependencies.nodeDeps = allDeps;

    } catch (error) {
      // package.json 不存在或解析失败
    }

    try {
      // 分析 requirements.txt
      const requirementsPath = path.join(projectPath, 'requirements.txt');
      const requirements = await fs.readFile(requirementsPath, 'utf8');
      
      dependencies.runtime = 'python';
      dependencies.packageManager = 'pip';

      // 检测 Python Web 框架
      if (requirements.includes('django')) dependencies.webFrameworks.push('django');
      if (requirements.includes('flask')) dependencies.webFrameworks.push('flask');
      if (requirements.includes('fastapi')) dependencies.webFrameworks.push('fastapi');

      // 检测 Python 数据库
      if (requirements.includes('psycopg2')) dependencies.databases.push('postgresql');
      if (requirements.includes('mysql-connector')) dependencies.databases.push('mysql');
      if (requirements.includes('pymongo')) dependencies.databases.push('mongodb');
      if (requirements.includes('redis')) dependencies.caches.push('redis');

    } catch (error) {
      // requirements.txt 不存在
    }

    try {
      // 分析 Dockerfile
      const dockerfilePath = path.join(projectPath, 'Dockerfile');
      const dockerfile = await fs.readFile(dockerfilePath, 'utf8');
      dependencies.docker = true;
      
      // 从 FROM 指令检测基础镜像
      const fromMatch = dockerfile.match(/^FROM\s+(\S+)/);
      if (fromMatch) {
        const baseImage = fromMatch[1].toLowerCase();
        if (baseImage.includes('node')) dependencies.runtime = 'node';
        else if (baseImage.includes('python')) dependencies.runtime = 'python';
        else if (baseImage.includes('java')) dependencies.runtime = 'java';
        else if (baseImage.includes('nginx')) dependencies.webFrameworks.push('nginx');
      }

    } catch (error) {
      // Dockerfile 不存在
    }

    // 检测 Docker Compose
    try {
      const composePath = path.join(projectPath, 'docker-compose.yml');
      await fs.access(composePath);
      dependencies.docker = true;
    } catch (error) {
      // docker-compose.yml 不存在
    }

    // Java: Maven
    try {
      const pomPath = path.join(projectPath, 'pom.xml');
      const pom = await fs.readFile(pomPath, 'utf8');
      dependencies.runtime = 'java';
      dependencies.packageManager = 'maven';
      if (pom.toLowerCase().includes('spring-boot')) dependencies.webFrameworks.push('spring-boot');
      dependencies.buildTools.push('maven');
    } catch (_) {}

    // Java: Gradle
    try {
      const gradlePath = path.join(projectPath, 'build.gradle');
      const gradle = await fs.readFile(gradlePath, 'utf8');
      dependencies.runtime = 'java';
      dependencies.packageManager = 'gradle';
      if (gradle.toLowerCase().includes('spring-boot')) dependencies.webFrameworks.push('spring-boot');
      dependencies.buildTools.push('gradle');
    } catch (_) {}

    // Go: go.mod
    try {
      const goModPath = path.join(projectPath, 'go.mod');
      const goMod = await fs.readFile(goModPath, 'utf8');
      dependencies.runtime = 'go';
      dependencies.packageManager = 'go-mod';
      if (goMod.includes('github.com/gin-gonic/gin')) dependencies.webFrameworks.push('gin');
      if (goMod.includes('github.com/labstack/echo')) dependencies.webFrameworks.push('echo');
    } catch (_) {}

    // Ruby: Gemfile
    try {
      const gemfilePath = path.join(projectPath, 'Gemfile');
      const gemfile = await fs.readFile(gemfilePath, 'utf8');
      dependencies.runtime = 'ruby';
      dependencies.packageManager = 'bundler';
      if (gemfile.toLowerCase().includes('rails')) dependencies.webFrameworks.push('rails');
      dependencies.buildTools.push('bundler');
    } catch (_) {}

    // PHP: composer.json
    try {
      const composerPath = path.join(projectPath, 'composer.json');
      const composerJson = JSON.parse(await fs.readFile(composerPath, 'utf8'));
      dependencies.runtime = 'php';
      dependencies.packageManager = 'composer';
      const cDeps = { ...(composerJson.require || {}), ...(composerJson['require-dev'] || {}) };
      if (cDeps['laravel/framework']) dependencies.webFrameworks.push('laravel');
      if (cDeps['symfony/symfony']) dependencies.webFrameworks.push('symfony');
    } catch (_) {}

    return dependencies;
  }

  generateServerRecommendations(dependencies, env = 'dev') {
    const recommendations = {
      webServer: 'nginx',
      database: null,
      packages: [],
      services: [],
      ports: []
    };

    // 根据运行时推荐
    switch (dependencies.runtime) {
      case 'node':
        recommendations.packages.push('nodejs', 'npm');
        recommendations.services.push('nodejs');
        break;
      case 'python':
        recommendations.packages.push('python3', 'python3-pip');
        recommendations.services.push('python3');
        break;
      case 'java':
        recommendations.packages.push('openjdk-11-jdk', 'maven');
        recommendations.services.push('java');
        break;
      case 'go':
        recommendations.packages.push('golang');
        recommendations.services.push('go');
        break;
      case 'ruby':
        recommendations.packages.push('ruby-full', 'bundler');
        recommendations.services.push('ruby');
        break;
      case 'php':
        recommendations.packages.push('php-fpm', 'composer');
        recommendations.services.push('php-fpm');
        break;
    }

    // 根据 Web 框架推荐
    if (dependencies.webFrameworks.includes('express') || dependencies.webFrameworks.includes('koa')) {
      recommendations.webServer = 'nginx';
      recommendations.packages.push('nginx');
      recommendations.services.push('nginx');
      recommendations.ports.push(80, 443);
    }

    if (dependencies.webFrameworks.includes('django') || dependencies.webFrameworks.includes('flask')) {
      recommendations.webServer = 'nginx';
      recommendations.packages.push('nginx', 'uwsgi');
      recommendations.services.push('nginx', 'uwsgi');
      recommendations.ports.push(80, 443);
    }

    if (dependencies.webFrameworks.includes('spring-boot')) {
      recommendations.webServer = 'nginx';
      recommendations.packages.push('nginx');
      recommendations.services.push('nginx');
      recommendations.ports.push(80, 443, 8080);
    }

    if (dependencies.webFrameworks.includes('gin') || dependencies.webFrameworks.includes('echo')) {
      recommendations.webServer = 'nginx';
      recommendations.packages.push('nginx');
      recommendations.services.push('nginx');
      recommendations.ports.push(80, 443, 8080);
    }

    if (dependencies.webFrameworks.includes('rails')) {
      recommendations.webServer = 'nginx';
      recommendations.packages.push('nginx');
      recommendations.services.push('nginx');
      recommendations.ports.push(80, 443);
    }

    if (dependencies.webFrameworks.includes('laravel') || dependencies.webFrameworks.includes('symfony')) {
      recommendations.webServer = 'nginx';
      recommendations.packages.push('nginx', 'php-fpm');
      recommendations.services.push('nginx', 'php-fpm');
      recommendations.ports.push(80, 443);
    }

    // 根据数据库推荐
    if (dependencies.databases.includes('mysql')) {
      recommendations.database = 'mysql';
      recommendations.packages.push('mysql-server');
      recommendations.services.push('mysql');
      recommendations.ports.push(3306);
    }

    if (dependencies.databases.includes('postgresql')) {
      recommendations.database = 'postgresql';
      recommendations.packages.push('postgresql', 'postgresql-contrib');
      recommendations.services.push('postgresql');
      recommendations.ports.push(5432);
    }

    if (dependencies.databases.includes('mongodb')) {
      recommendations.database = 'mongodb';
      recommendations.packages.push('mongodb');
      recommendations.services.push('mongodb');
      recommendations.ports.push(27017);
    }

    // 根据缓存推荐
    if (dependencies.caches.includes('redis')) {
      recommendations.packages.push('redis-server');
      recommendations.services.push('redis');
      recommendations.ports.push(6379);
    }

    // 根据消息队列推荐
    if (dependencies.messageQueues.includes('rabbitmq')) {
      recommendations.packages.push('rabbitmq-server');
      recommendations.services.push('rabbitmq');
      recommendations.ports.push(5672);
    }

    // Docker 支持
    if (dependencies.docker) {
      recommendations.packages.push('docker.io', 'docker-compose');
      recommendations.services.push('docker');
    }

    // 构建工具
    if (dependencies.buildTools.includes('webpack') || dependencies.buildTools.includes('vite')) {
      recommendations.packages.push('nodejs', 'npm');
    }

    if (dependencies.buildTools.includes('typescript')) {
      recommendations.packages.push('nodejs', 'npm');
    }

    // 环境：生产增加证书工具
    if (env === 'prod') {
      if (!recommendations.packages.includes('nginx')) {
        recommendations.packages.push('nginx');
      }
      recommendations.packages.push('certbot');
    }

    return recommendations;
  }

  evaluateProjectHealth(dependencies) {
    let score = 50;
    const notes = [];

    if (dependencies.packageManager !== 'unknown') score += 10;
    if (dependencies.testFrameworks.length > 0) score += 10; else notes.push('缺少测试框架');
    if (dependencies.docker) score += 10; else notes.push('未检测到 Docker/Compose');
    if (dependencies.runtime === 'unknown') { score -= 15; notes.push('未识别运行时'); }
    if (dependencies.webFrameworks.length === 0) notes.push('未识别 Web 框架');

    score = Math.max(0, Math.min(100, score));
    return { score, notes };
  }

  scanSecurityIssues(dependencies) {
    const issues = [];

    // Node: Express 缺少安全中间件
    if (dependencies.webFrameworks.includes('express')) {
      const deps = dependencies.nodeDeps || {};
      if (!deps.helmet) {
        issues.push({ stack: 'node', component: 'express', issue: '缺少 helmet 安全中间件', severity: 'medium' });
      }
    }

    // Python: Django 建议启用安全设置
    if (dependencies.webFrameworks.includes('django')) {
      issues.push({ stack: 'python', component: 'django', issue: '建议启用安全中间件与 HTTPS', severity: 'low' });
    }

    // PHP: Laravel 建议开启 HTTPS 和 CSRF
    if (dependencies.webFrameworks.includes('laravel')) {
      issues.push({ stack: 'php', component: 'laravel', issue: '建议启用 HTTPS 与 CSRF 防护', severity: 'low' });
    }

    return issues;
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[EN] MCP server started on stdio');
    console.error('[ZH] MCP 服务器已通过 stdio 启动');
  }
}

// 如果直接运行此文件，启动服务器
if (require.main === module) {
  const mcpServer = new MCPServer();
  mcpServer.start().catch(console.error);
}

module.exports = { MCPServer };