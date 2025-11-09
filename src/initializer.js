const { NodeSSH } = require('node-ssh');
const config = require('../config/config');

class ServerInitializer {
  constructor() {
    this.ssh = new NodeSSH();
    this.initializationSteps = [];
  }

  /**
   * 连接到服务器
   * @param {Object} connectionConfig - SSH连接配置
   * @returns {Promise<boolean>} 连接是否成功
   */
  async connect(connectionConfig) {
    try {
      await this.ssh.connect({
        host: connectionConfig.host,
        username: connectionConfig.username,
        password: connectionConfig.password,
        privateKey: connectionConfig.privateKey,
        passphrase: connectionConfig.passphrase,
        port: connectionConfig.port || 22,
        timeout: config.ssh.timeout
      });
      return true;
    } catch (error) {
      console.error(`[EN] SSH connection failed: ${error.message}`);
      console.error(`[ZH] SSH连接失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 断开连接
   */
  async disconnect() {
    if (this.ssh.isConnected()) {
      await this.ssh.dispose();
    }
  }

  /**
   * 执行完整的初始化流程
   * @param {Object} connectionConfig - SSH连接配置
   * @param {Object} options - 初始化选项
   * @returns {Promise<Object>} 初始化结果
   */
  async performFullInitialization(connectionConfig, options = {}) {
    const results = {
      timestamp: new Date().toISOString(),
      server: connectionConfig.host,
      steps: [],
      success: true,
      errors: []
    };

    try {
      // 1. 连接到服务器
      console.log('[EN] Connecting to server...');
      console.log('[ZH] 连接到服务器...');
      const connected = await this.connect(connectionConfig);
      if (!connected) {
        results.success = false;
        results.errors.push('SSH连接失败');
        return results;
      }

      // 2. 系统更新
      if (options.updateSystem !== false) {
        console.log('[EN] Updating system...');
        console.log('[ZH] 更新系统...');
        const updateResult = await this.updateSystem();
        results.steps.push({
          name: 'system_update',
          success: updateResult.success,
          details: updateResult
        });
        if (!updateResult.success) {
          results.errors.push('系统更新失败: ' + updateResult.error);
        }
      }

      // 3. 安装基础软件包
      console.log('[EN] Installing base packages...');
      console.log('[ZH] 安装基础软件包...');
      const basePackagesResult = await this.installBasePackages();
      results.steps.push({
        name: 'base_packages',
        success: basePackagesResult.success,
        details: basePackagesResult
      });
      if (!basePackagesResult.success) {
        results.errors.push('基础软件包安装失败: ' + basePackagesResult.error);
      }

      // 4. 配置防火墙
      if (options.configureFirewall !== false) {
        console.log('[EN] Configuring firewall...');
        console.log('[ZH] 配置防火墙...');
        const firewallResult = await this.configureFirewall(options.firewallRules || []);
        results.steps.push({
          name: 'firewall',
          success: firewallResult.success,
          details: firewallResult
        });
        if (!firewallResult.success) {
          results.errors.push('防火墙配置失败: ' + firewallResult.error);
        }
      }

      // 5. 配置Web服务器
      if (options.webServer) {
        console.log('[EN] Configuring web server...');
        console.log('[ZH] 配置Web服务器...');
        const webServerResult = await this.configureWebServer(options.webServer);
        results.steps.push({
          name: 'web_server',
          success: webServerResult.success,
          details: webServerResult
        });
        if (!webServerResult.success) {
          results.errors.push('Web服务器配置失败: ' + webServerResult.error);
        }
      }

      // 6. 配置数据库
      if (options.database) {
        console.log('[EN] Configuring database...');
        console.log('[ZH] 配置数据库...');
        const databaseResult = await this.configureDatabase(options.database);
        results.steps.push({
          name: 'database',
          success: databaseResult.success,
          details: databaseResult
        });
        if (!databaseResult.success) {
          results.errors.push('数据库配置失败: ' + databaseResult.error);
        }
      }

      // 7. 网络优化
      if (options.networkOptimization !== false) {
        console.log('[EN] Optimizing network...');
        console.log('[ZH] 网络优化...');
        const networkResult = await this.optimizeNetwork();
        results.steps.push({
          name: 'network_optimization',
          success: networkResult.success,
          details: networkResult
        });
        if (!networkResult.success) {
          results.errors.push('网络优化失败: ' + networkResult.error);
        }
      }

      // 8. 安全加固
      if (options.securityHardening !== false) {
        console.log('[EN] Performing security hardening...');
        console.log('[ZH] 安全加固...');
        const securityResult = await this.performSecurityHardening();
        results.steps.push({
          name: 'security_hardening',
          success: securityResult.success,
          details: securityResult
        });
        if (!securityResult.success) {
          results.errors.push('安全加固失败: ' + securityResult.error);
        }
      }

      await this.disconnect();
      
      // 检查是否有任何步骤失败
      results.success = results.steps.every(step => step.success);
      
    } catch (error) {
      console.error(`[EN] Initialization error: ${error.message}`);
      console.error(`[ZH] 初始化过程中出错: ${error.message}`);
      results.success = false;
      results.errors.push('初始化过程出错: ' + error.message);
    }

    return results;
  }

  /**
   * 系统更新
   * @returns {Promise<Object>} 更新结果
   */
  async updateSystem() {
    const result = {
      success: false,
      commands: [],
      output: []
    };

    try {
      // 更新包列表
      const updateCmd = await this.ssh.execCommand('sudo apt update');
      result.commands.push('sudo apt update');
      result.output.push(updateCmd.stdout);
      
      if (updateCmd.code !== 0) {
        result.error = '更新包列表失败: ' + updateCmd.stderr;
        return result;
      }

      // 升级系统包
      const upgradeCmd = await this.ssh.execCommand('sudo apt upgrade -y');
      result.commands.push('sudo apt upgrade -y');
      result.output.push(upgradeCmd.stdout);
      
      if (upgradeCmd.code !== 0) {
        result.error = '系统升级失败: ' + upgradeCmd.stderr;
        return result;
      }

      result.success = true;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * 安装基础软件包
   * @returns {Promise<Object>} 安装结果
   */
  async installBasePackages() {
    const result = {
      success: false,
      installed: [],
      failed: []
    };

    const basePackages = [
      'curl', 'wget', 'git', 'vim', 'htop', 'net-tools', 'ufw',
      'fail2ban', 'unattended-upgrades', 'software-properties-common'
    ];

    try {
      for (const pkg of basePackages) {
        const installCmd = await this.ssh.execCommand(`sudo apt install -y ${pkg}`);
        if (installCmd.code === 0) {
          result.installed.push(pkg);
        } else {
          result.failed.push({ package: pkg, error: installCmd.stderr });
        }
      }

      result.success = result.failed.length === 0;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * 配置防火墙
   * @param {Array} customRules - 自定义防火墙规则
   * @returns {Promise<Object>} 配置结果
   */
  async configureFirewall(customRules = []) {
    const result = {
      success: false,
      rules: [],
      enabled: false
    };

    try {
      // 启用UFW
      const enableCmd = await this.ssh.execCommand('sudo ufw --force enable');
      if (enableCmd.code === 0) {
        result.enabled = true;
      }

      // 默认策略
      const defaultDenyCmd = await this.ssh.execCommand('sudo ufw default deny incoming');
      const defaultAllowCmd = await this.ssh.execCommand('sudo ufw default allow outgoing');
      
      if (defaultDenyCmd.code === 0 && defaultAllowCmd.code === 0) {
        result.rules.push('Default deny incoming');
        result.rules.push('Default allow outgoing');
      }

      // 基础规则
      const basicRules = [
        { port: 22, protocol: 'tcp', action: 'allow', comment: 'SSH' },
        { port: 80, protocol: 'tcp', action: 'allow', comment: 'HTTP' },
        { port: 443, protocol: 'tcp', action: 'allow', comment: 'HTTPS' }
      ];

      // 应用基础规则
      for (const rule of basicRules) {
        const ruleCmd = await this.ssh.execCommand(`sudo ufw ${rule.action} ${rule.port}/${rule.protocol}`);
        if (ruleCmd.code === 0) {
          result.rules.push(`${rule.comment} (${rule.port}/${rule.protocol})`);
        }
      }

      // 应用自定义规则
      for (const rule of customRules) {
        const ruleCmd = await this.ssh.execCommand(`sudo ufw ${rule.action} ${rule.port}/${rule.protocol}`);
        if (ruleCmd.code === 0) {
          result.rules.push(`${rule.comment || 'Custom'} (${rule.port}/${rule.protocol})`);
        }
      }

      result.success = true;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * 配置Web服务器
   * @param {Object} webServerConfig - Web服务器配置
   * @returns {Promise<Object>} 配置结果
   */
  async configureWebServer(webServerConfig) {
    const result = {
      success: false,
      serverType: webServerConfig.type || 'nginx',
      installed: false,
      configured: false
    };

    try {
      const serverType = webServerConfig.type || 'nginx';
      
      // 安装Web服务器
      const installCmd = await this.ssh.execCommand(`sudo apt install -y ${serverType}`);
      if (installCmd.code === 0) {
        result.installed = true;
      }

      if (serverType === 'nginx') {
        result.configured = await this.configureNginx(webServerConfig);
      } else if (serverType === 'apache') {
        result.configured = await this.configureApache(webServerConfig);
      }

      result.success = result.installed && result.configured;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * 配置Nginx
   * @param {Object} config - Nginx配置
   * @returns {Promise<boolean>} 配置是否成功
   */
  async configureNginx(config) {
    try {
      // 基础Nginx配置
      const nginxConf = `
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    
    server_name _;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}`;

      // 创建配置文件
      await this.ssh.execCommand(`echo "${nginxConf}" | sudo tee /etc/nginx/sites-available/default`);
      
      // 测试配置
      const testCmd = await this.ssh.execCommand('sudo nginx -t');
      if (testCmd.code !== 0) {
        return false;
      }

      // 重启Nginx
      const restartCmd = await this.ssh.execCommand('sudo systemctl restart nginx');
      return restartCmd.code === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 配置Apache
   * @param {Object} config - Apache配置
   * @returns {Promise<boolean>} 配置是否成功
   */
  async configureApache(config) {
    try {
      // 启用必要模块
      await this.ssh.execCommand('sudo a2enmod rewrite');
      await this.ssh.execCommand('sudo a2enmod headers');
      
      // 重启Apache
      const restartCmd = await this.ssh.execCommand('sudo systemctl restart apache2');
      return restartCmd.code === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 配置数据库
   * @param {Object} dbConfig - 数据库配置
   * @returns {Promise<Object>} 配置结果
   */
  async configureDatabase(dbConfig) {
    const result = {
      success: false,
      databaseType: dbConfig.type || 'mysql',
      installed: false,
      configured: false
    };

    try {
      const dbType = dbConfig.type || 'mysql';
      
      if (dbType === 'mysql') {
        result.configured = await this.configureMySQL(dbConfig);
      } else if (dbType === 'postgresql') {
        result.configured = await this.configurePostgreSQL(dbConfig);
      }

      result.success = result.configured;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * 配置MySQL
   * @param {Object} config - MySQL配置
   * @returns {Promise<boolean>} 配置是否成功
   */
  async configureMySQL(config) {
    try {
      // 安装MySQL
      const installCmd = await this.ssh.execCommand('sudo apt install -y mysql-server');
      if (installCmd.code !== 0) {
        return false;
      }

      // 安全配置
      const secureCmd = await this.ssh.execCommand('sudo mysql_secure_installation');
      
      // 启动MySQL服务
      const startCmd = await this.ssh.execCommand('sudo systemctl start mysql');
      const enableCmd = await this.ssh.execCommand('sudo systemctl enable mysql');
      
      return startCmd.code === 0 && enableCmd.code === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 配置PostgreSQL
   * @param {Object} config - PostgreSQL配置
   * @returns {Promise<boolean>} 配置是否成功
   */
  async configurePostgreSQL(config) {
    try {
      // 安装PostgreSQL
      const installCmd = await this.ssh.execCommand('sudo apt install -y postgresql postgresql-contrib');
      if (installCmd.code !== 0) {
        return false;
      }

      // 启动PostgreSQL服务
      const startCmd = await this.ssh.execCommand('sudo systemctl start postgresql');
      const enableCmd = await this.ssh.execCommand('sudo systemctl enable postgresql');
      
      return startCmd.code === 0 && enableCmd.code === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 网络优化
   * @returns {Promise<Object>} 优化结果
   */
  async optimizeNetwork() {
    const result = {
      success: false,
      optimizations: []
    };

    try {
      // TCP优化
      const tcpOptimizations = [
        'net.core.rmem_max = 16777216',
        'net.core.wmem_max = 16777216',
        'net.ipv4.tcp_rmem = 4096 87380 16777216',
        'net.ipv4.tcp_wmem = 4096 65536 16777216',
        'net.ipv4.tcp_congestion_control = cubic',
        'net.ipv4.tcp_fin_timeout = 30',
        'net.ipv4.tcp_keepalive_time = 1200',
        'net.ipv4.tcp_max_syn_backlog = 8192',
        'net.ipv4.tcp_max_tw_buckets = 5000'
      ];

      // 添加到sysctl配置
      for (const optimization of tcpOptimizations) {
        const cmd = await this.ssh.execCommand(`echo "${optimization}" | sudo tee -a /etc/sysctl.conf`);
        if (cmd.code === 0) {
          result.optimizations.push(optimization);
        }
      }

      // 应用优化
      const applyCmd = await this.ssh.execCommand('sudo sysctl -p');
      result.success = applyCmd.code === 0;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * 安全加固
   * @returns {Promise<Object>} 加固结果
   */
  async performSecurityHardening() {
    const result = {
      success: false,
      hardening: []
    };

    try {
      // 配置fail2ban
      const fail2banCmd = await this.ssh.execCommand('sudo systemctl enable fail2ban && sudo systemctl start fail2ban');
      if (fail2banCmd.code === 0) {
        result.hardening.push('Fail2ban服务已启用');
      }

      // 配置自动更新
      const autoUpdateCmd = await this.ssh.execCommand('sudo systemctl enable unattended-upgrades && sudo systemctl start unattended-upgrades');
      if (autoUpdateCmd.code === 0) {
        result.hardening.push('自动更新已启用');
      }

      // SSH配置加固
      const sshHardening = [
        'sed -i "s/#PermitRootLogin yes/PermitRootLogin no/" /etc/ssh/sshd_config',
        'sed -i "s/PermitRootLogin yes/PermitRootLogin no/" /etc/ssh/sshd_config',
        'sed -i "s/#PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config',
        'echo "AllowUsers ubuntu" >> /etc/ssh/sshd_config'
      ];

      for (const cmd of sshHardening) {
        const result = await this.ssh.execCommand(`sudo ${cmd}`);
        if (result.code === 0) {
          result.hardening.push('SSH配置已加固');
        }
      }

      // 重启SSH服务
      const sshRestartCmd = await this.ssh.execCommand('sudo systemctl restart sshd');
      result.success = sshRestartCmd.code === 0;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * 包装方法：与外部接口保持一致
   * @param {Object} connectionConfig
   * @param {Object} options
   */
  async initialize(connectionConfig, options = {}) {
    return this.performFullInitialization(connectionConfig, options);
  }
}

module.exports = ServerInitializer;