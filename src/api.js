const express = require('express');
const cors = require('cors');
const ServerInspector = require('./inspector');
const ServerInitializer = require('./initializer');
const { MCPServer } = require('./mcp-server.js');
const winston = require('winston');

// 配置日志
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'serverready-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class APIServer {
  constructor(port = 3000) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  // 双语响应辅助方法
  respondOk(res, data, en = 'Operation completed successfully.', zh = '操作已成功完成。', success = true) {
    return res.json({ success, messages: { en, zh }, data });
  }

  respondFail(res, status, errorMsg, en = 'Operation failed.', zh = '操作失败。', extra = {}) {
    return res.status(status).json({ success: false, error: errorMsg, messages: { en, zh }, ...extra });
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    this.app.use(cors());
    // 自定义JSON解析，返回400而不是抛出500
    this.app.use((req, res, next) => {
      express.json({ limit: '10mb' })(req, res, (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            error: 'Invalid JSON',
            messages: { en: 'Invalid JSON payload.', zh: '无效的 JSON 负载。' }
          });
        }
        next();
      });
    });
    this.app.use(express.urlencoded({ extended: true }));
    
    // 请求日志
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API版本信息
    this.app.get('/api/version', (req, res) => {
      res.json({
        version: '1.0.0',
        name: 'ServerReady API',
        description: '服务器预检与初始化API'
      });
    });

    // 服务器预检
    this.app.post('/api/inspect', async (req, res) => {
      try {
        const { host, username, password, privateKey, port } = req.body;
        
        // 参数验证
        if (!host) {
          return this.respondFail(res, 400, '缺少必需参数: host', 'Missing required parameter: host', '缺少必需参数：host');
        }

        if (!password && !privateKey) {
          return this.respondFail(res, 400, '必须提供password或privateKey', 'Password or privateKey is required', '必须提供 password 或 privateKey');
        }

        const connectionConfig = { host, username: username || 'root' };
        if (password) connectionConfig.password = password;
        if (privateKey) connectionConfig.privateKey = privateKey;
        if (typeof port !== 'undefined') connectionConfig.port = parseInt(port);

        logger.info('开始服务器预检', { host, username: connectionConfig.username });
        
        const inspector = this.inspector || new ServerInspector();
        const results = await inspector.inspect(connectionConfig);
        
        logger.info('服务器预检完成', { 
          host, 
          success: !results.error,
          recommendations: results.recommendations?.length || 0
        });

        this.respondOk(res, results, 'Inspection completed successfully.', '预检已成功完成。');

      } catch (error) {
        logger.error('服务器预检失败', { error: error.message });
        this.respondFail(res, 500, error.message, 'Inspection failed.', '预检失败。');
      }
    });

    // 服务器初始化
    this.app.post('/api/init', async (req, res) => {
      try {
        const { 
          host, 
          username, 
          password, 
          privateKey, 
          port = 22,
          webServer,
          database,
          firewallRules = [],
          skipFirewall = false,
          skipUpdate = false,
          skipNetwork = false,
          skipSecurity = false
        } = req.body;
        
        // 参数验证
        if (!host) {
          return this.respondFail(res, 400, '缺少必需参数: host', 'Missing required parameter: host', '缺少必需参数：host');
        }

        if (!password && !privateKey) {
          return this.respondFail(res, 400, '必须提供password或privateKey', 'Password or privateKey is required', '必须提供 password 或 privateKey');
        }

        const connectionConfig = {
          host,
          username: username || 'root',
          password,
          privateKey,
          port: parseInt(port)
        };

        const initOptions = {
          updateSystem: !skipUpdate,
          configureFirewall: !skipFirewall,
          networkOptimization: !skipNetwork,
          securityHardening: !skipSecurity,
          webServer: webServer ? { type: webServer } : null,
          database: database ? { type: database } : null,
          firewallRules
        };

        logger.info('开始服务器初始化', { 
          host, 
          username: connectionConfig.username,
          webServer,
          database
        });
        
        const initializer = this.initializer || new ServerInitializer();
        const results = await initializer.initialize(connectionConfig, initOptions);
        
        logger.info('服务器初始化完成', { 
          host, 
          success: results.success,
          steps: results.steps?.length || 0,
          errors: results.errors?.length || 0
        });

        const enMsg = results.success ? 'Initialization completed successfully.' : 'Initialization failed.';
        const zhMsg = results.success ? '初始化已成功完成。' : '初始化失败。';
        this.respondOk(res, results, enMsg, zhMsg, results.success);

      } catch (error) {
        logger.error('服务器初始化失败', { error: error.message });
        this.respondFail(res, 500, error.message, 'Initialization failed.', '初始化失败。');
      }
    });

    // 快速检查
    this.app.post('/api/quick-check', async (req, res) => {
      try {
        const { host, username, password, privateKey, port = 22 } = req.body;
        
        // 参数验证
        if (!host) {
          return this.respondFail(res, 400, '缺少必需参数: host', 'Missing required parameter: host', '缺少必需参数：host');
        }

        if (!password && !privateKey) {
          return this.respondFail(res, 400, '必须提供password或privateKey', 'Password or privateKey is required', '必须提供 password 或 privateKey');
        }

        const connectionConfig = {
          host,
          username: username || 'root',
          password,
          privateKey,
          port: parseInt(port)
        };

        logger.info('开始快速检查', { host, username: connectionConfig.username });
        const inspector = this.inspector || new ServerInspector();
        const quick = await inspector.quickCheck(connectionConfig);
        logger.info('快速检查完成', { host });

        this.respondOk(res, quick, 'Quick check completed successfully.', '快速检查已成功完成。');

      } catch (error) {
        logger.error('快速检查失败', { error: error.message });
        this.respondFail(res, 500, error.message, 'Quick check failed.', '快速检查失败。');
      }
    });

    // 获取配置信息（直接返回配置对象）
    this.app.get('/api/config', (req, res) => {
      const cfg = require('../config/config');
      res.json(cfg);
    });

    // 批量操作
    this.app.post('/api/batch', async (req, res) => {
      try {
        const { servers, operation, options = {} } = req.body;
        
        if (!servers || !Array.isArray(servers) || servers.length === 0) {
          return this.respondFail(res, 400, '必须提供服务器列表', 'Servers list is required', '必须提供服务器列表');
        }

        const op = operation || 'inspect';
        if (!['inspect', 'init'].includes(op)) {
          return this.respondFail(res, 400, '操作必须是 inspect 或 init', 'Operation must be inspect or init', '操作必须是 inspect 或 init');
        }

        logger.info('开始批量操作', { operation: op, serverCount: servers.length });

        const results = [];
        
        for (const server of servers) {
          try {
            let result;
            
            if (op === 'inspect') {
              const inspector = this.inspector || new ServerInspector();
              result = await inspector.inspect(server);
              await inspector.disconnect();
            } else if (op === 'init') {
              const initializer = this.initializer || new ServerInitializer();
              result = await initializer.initialize(server, options);
              await initializer.disconnect();
            }
            
            results.push(result);
            
          } catch (error) {
            results.push({ error: error.message });
          }
        }

        logger.info('批量操作完成', { operation: op, total: servers.length });
        this.respondOk(res, results, 'Batch operation completed.', '批量操作已完成。');

      } catch (error) {
        logger.error('批量操作失败', { error: error.message });
        this.respondFail(res, 500, error.message, 'Batch operation failed.', '批量操作失败。');
      }
    });

    // 端口检查路由
    this.app.post('/api/check-port', async (req, res) => {
      try {
        const { host, port } = req.body;
        if (!host || typeof port !== 'number') {
          return this.respondFail(res, 400, '缺少必需参数: host 或 port', 'Missing required parameter: host or port', '缺少必需参数：host 或 port');
        }
        const inspector = this.inspector || new ServerInspector();
        const open = await inspector.checkPort(host, port);
        return this.respondOk(res, { open }, 'Port check completed.', '端口检查已完成。');
      } catch (error) {
        logger.error('端口检查失败', { error: error.message });
        return this.respondFail(res, 500, error.message, 'Port check failed.', '端口检查失败。');
      }
    });

    // 依赖分析（本地项目）
    this.app.post('/api/deps/analyze', async (req, res) => {
      try {
        const { projectPath = process.cwd(), env = 'dev' } = req.body || {};

        const mcp = new MCPServer();
        const dependencies = await mcp.analyzeProjectDependencies(projectPath);
        const health = mcp.evaluateProjectHealth(dependencies);
        const securityIssues = mcp.scanSecurityIssues(dependencies);
        const recommendations = mcp.generateServerRecommendations(dependencies, env);

        this.respondOk(res, {
          projectPath,
          dependencies,
          recommendations,
          health,
          securityIssues,
          timestamp: new Date().toISOString()
        }, 'Dependency analysis completed.', '依赖分析已完成。');
      } catch (error) {
        logger.error('依赖分析失败', { error: error.message });
        this.respondFail(res, 500, error.message, 'Dependency analysis failed.', '依赖分析失败。');
      }
    });

    // 自动配置（根据项目依赖）
    this.app.post('/api/deps/auto-config', async (req, res) => {
      try {
        const { 
          host,
          username = 'root',
          password,
          privateKey,
          port = 22,
          projectPath = process.cwd(),
          env = 'dev'
        } = req.body || {};

        if (!host) {
          return this.respondFail(res, 400, '缺少必需参数: host', 'Missing required parameter: host', '缺少必需参数：host');
        }
        if (!password && !privateKey) {
          return this.respondFail(res, 400, '必须提供password或privateKey', 'Password or privateKey is required', '必须提供 password 或 privateKey');
        }

        const connectionConfig = {
          host,
          username,
          password,
          privateKey,
          port: parseInt(port)
        };

        const mcp = new MCPServer();
        const dependencies = await mcp.analyzeProjectDependencies(projectPath);
        const recommendations = mcp.generateServerRecommendations(dependencies, env);
        const health = mcp.evaluateProjectHealth(dependencies);
        const securityIssues = mcp.scanSecurityIssues(dependencies);

        const initOptions = {
          updateSystem: true,
          configureFirewall: true,
          networkOptimization: true,
          securityHardening: env === 'prod',
          webServer: recommendations.webServer ? { type: recommendations.webServer } : null,
          database: recommendations.database ? { type: recommendations.database } : null,
        };

        const initializer = this.initializer || new ServerInitializer();
        const initResult = await initializer.initialize(connectionConfig, initOptions);

        this.respondOk(res, {
          message: 'Auto configuration completed',
          dependencies,
          recommendations,
          health,
          securityIssues,
          initializationResult: initResult,
          timestamp: new Date().toISOString()
        }, 'Auto configuration completed.', '自动配置已完成。', initResult.success);
      } catch (error) {
        logger.error('自动配置失败', { error: error.message });
        this.respondFail(res, 500, error.message, 'Auto configuration failed.', '自动配置失败。');
      }
    });

    // 404处理
    this.app.use((req, res) => {
      this.respondFail(res, 404, 'API端点不存在', 'API endpoint not found', 'API端点不存在', {
        availableEndpoints: [
          'GET /health',
          'GET /api/version',
          'POST /api/inspect',
          'POST /api/init',
          'POST /api/quick-check',
          'GET /api/config',
          'POST /api/batch',
          'POST /api/check-port',
          'POST /api/deps/analyze',
          'POST /api/deps/auto-config'
        ]
      });
    });

    // 错误处理中间件
    this.app.use((error, req, res, next) => {
      logger.error('未处理的错误', { error: error.message, stack: error.stack });
      this.respondFail(res, 500, '内部服务器错误', 'Internal server error', '内部服务器错误', { message: error.message });
    });
  }

  /**
   * 启动服务器
   */
  start() {
    // 创建日志目录
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.server = this.app.listen(this.port, () => {
      logger.info(`ServerReady API服务器启动`, { port: this.port });
      console.log(`[EN] 🚀 ServerReady API is running on port ${this.port}`);
      console.log(`[ZH] 🚀 ServerReady API服务器运行在端口 ${this.port}`);
      console.log(`[EN] 📊 Health: http://localhost:${this.port}/health`);
      console.log(`[ZH] 📊 健康检查: http://localhost:${this.port}/health`);
      console.log(`[EN] 📚 API Version: http://localhost:${this.port}/api/version`);
      console.log(`[ZH] 📚 API文档: http://localhost:${this.port}/api/version`);
    });

    return this.server;
  }

  /**
   * 停止服务器
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        logger.info('ServerReady API服务器已停止');
      });
    }
  }
}

// 如果直接运行此文件，启动服务器
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const apiServer = new APIServer(port);
  apiServer.start();
}

module.exports = APIServer;