const { NodeSSH } = require('node-ssh');
const net = require('net');
const dns = require('dns');
const { promisify } = require('util');
const config = require('../config/config');

class ServerInspector {
  constructor() {
    this.ssh = new NodeSSH();
    this.dnsLookup = promisify(dns.lookup);
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
   * 执行完整的预检流程
   * @param {Object} connectionConfig - SSH连接配置
   * @returns {Promise<Object>} 检查结果
   */
  async performFullInspection(connectionConfig) {
    const results = {
      timestamp: new Date().toISOString(),
      server: connectionConfig.host,
      network: {},
      services: {},
      system: {},
      security: {},
      recommendations: []
    };

    try {
      // 1. 网络连通性检查
      console.log('[EN] Starting network connectivity check...');
      console.log('[ZH] 开始网络连通性检查...');
      results.network = await this.checkNetworkConnectivity(connectionConfig.host);
      
      // 2. SSH连接检查
      console.log('[EN] Checking SSH connectivity...');
      console.log('[ZH] 检查SSH连接...');
      const sshConnected = await this.connect(connectionConfig);
      if (!sshConnected) {
        results.network.sshAccessible = false;
        results.recommendations.push('SSH连接失败，请检查SSH服务状态和凭据');
        return results;
      }
      results.network.sshAccessible = true;

      // 3. 服务端口检查
      console.log('[EN] Checking service ports...');
      console.log('[ZH] 检查服务端口...');
      results.services = await this.checkServicePorts(connectionConfig.host);

      // 4. 系统资源检查
      console.log('[EN] Checking system resources...');
      console.log('[ZH] 检查系统资源...');
      results.system = await this.checkSystemResources();

      // 5. 安全检查
      console.log('[EN] Performing security checks...');
      console.log('[ZH] 进行安全检查...');
      results.security = await this.checkSecuritySettings();

      // 6. 生成建议
      console.log('[EN] Generating optimization recommendations...');
      console.log('[ZH] 生成优化建议...');
      results.recommendations = this.generateRecommendations(results);

      await this.disconnect();
      
    } catch (error) {
      console.error(`[EN] Inspection error: ${error.message}`);
      console.error(`[ZH] 预检过程中出错: ${error.message}`);
      results.error = error.message;
    }

    return results;
  }

  /**
   * 检查网络连通性
   * @param {string} hostname - 主机名或IP地址
   * @returns {Promise<Object>} 网络检查结果
   */
  async checkNetworkConnectivity(hostname) {
    const result = {
      dnsResolution: false,
      pingLatency: null,
      packetLoss: null,
      timestamp: new Date().toISOString()
    };

    try {
      // DNS解析检查
      const dnsResult = await this.dnsLookup(hostname);
      result.dnsResolution = true;
      result.ipAddress = dnsResult.address;
      
      // 使用ping检查延迟（通过SSH执行ping命令）
      if (this.ssh.isConnected()) {
        const pingResult = await this.ssh.execCommand(`ping -c 4 -W 2 ${hostname}`);
        if (pingResult.code === 0) {
          const latencyMatch = pingResult.stdout.match(/time=([\d.]+)ms/);
          if (latencyMatch) {
            result.pingLatency = parseFloat(latencyMatch[1]);
          }
          
          const lossMatch = pingResult.stdout.match(/(\d+)% packet loss/);
          if (lossMatch) {
            result.packetLoss = parseInt(lossMatch[1]);
          }
        }
      }
    } catch (error) {
      console.error('网络连通性检查失败:', error.message);
      result.error = error.message;
    }

    return result;
  }

  /**
   * 检查服务端口
   * @param {string} hostname - 主机名或IP地址
   * @returns {Promise<Object>} 端口检查结果
   */
  async checkServicePorts(hostname) {
    const result = {
      web: {},
      database: {},
      ssh: {},
      timestamp: new Date().toISOString()
    };

    // 检查Web服务端口
    for (const port of config.services.web.ports) {
      const isOpen = await this.checkPort(hostname, port);
      result.web[port] = {
        open: isOpen,
        service: this.getServiceName(port)
      };
    }

    // 检查数据库端口
    for (const port of config.services.database.ports) {
      const isOpen = await this.checkPort(hostname, port);
      result.database[port] = {
        open: isOpen,
        service: this.getServiceName(port)
      };
    }

    // 检查SSH端口
    const sshPort = config.services.ssh.port;
    result.ssh[sshPort] = {
      open: await this.checkPort(hostname, sshPort),
      service: 'SSH'
    };

    return result;
  }

  /**
   * 检查单个端口是否开放
   * @param {string} hostname - 主机名
   * @param {number} port - 端口号
   * @returns {Promise<boolean>} 端口是否开放
   */
  async checkPort(hostname, port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(config.network.portTimeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, hostname);
    });
  }

  /**
   * 检查系统资源
   * @returns {Promise<Object>} 系统资源检查结果
   */
  async checkSystemResources() {
    const result = {
      disk: {},
      memory: {},
      cpu: {},
      load: {},
      processes: {},
      timestamp: new Date().toISOString()
    };

    if (!this.ssh.isConnected()) {
      result.error = 'SSH连接未建立';
      return result;
    }

    try {
      // 磁盘使用情况
      const diskResult = await this.ssh.execCommand('df -h / | tail -1');
      if (diskResult.code === 0) {
        const diskParts = diskResult.stdout.trim().split(/\s+/);
        result.disk = {
          total: diskParts[1],
          used: diskParts[2],
          available: diskParts[3],
          usage: parseInt(diskParts[4].replace('%', '')),
          healthy: parseInt(diskParts[4].replace('%', '')) < config.system.diskThreshold
        };
      }

      // 内存使用情况
      const memResult = await this.ssh.execCommand('free -m | grep "Mem:"');
      if (memResult.code === 0) {
        const memParts = memResult.stdout.trim().split(/\s+/);
        const total = parseInt(memParts[1]);
        const used = parseInt(memParts[2]);
        const usage = Math.round((used / total) * 100);
        
        result.memory = {
          total: `${total}MB`,
          used: `${used}MB`,
          free: `${memParts[3]}MB`,
          usage: usage,
          healthy: usage < config.system.memoryThreshold
        };
      }

      // CPU信息
      const cpuResult = await this.ssh.execCommand('lscpu | grep "Model name"');
      if (cpuResult.code === 0) {
        result.cpu.model = cpuResult.stdout.split(':')[1].trim();
      }

      // CPU使用率 (使用top命令)
      const cpuUsageResult = await this.ssh.execCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
      if (cpuUsageResult.code === 0) {
        const cpuUsage = parseFloat(cpuUsageResult.stdout.trim());
        result.cpu.usage = cpuUsage;
        result.cpu.healthy = cpuUsage < config.system.cpuThreshold;
      }

      // 负载平均值
      const loadResult = await this.ssh.execCommand('uptime | awk -F"load average:" \'{print $2}\'');
      if (loadResult.code === 0) {
        const loadAverages = loadResult.stdout.trim().split(',').map(l => parseFloat(l.trim()));
        result.load = {
          '1min': loadAverages[0],
          '5min': loadAverages[1],
          '15min': loadAverages[2],
          healthy: loadAverages[0] < config.system.loadAverageThreshold
        };
      }

      // 进程信息
      const procResult = await this.ssh.execCommand('ps aux | wc -l');
      if (procResult.code === 0) {
        result.processes.count = parseInt(procResult.stdout.trim()) - 1; // 减去标题行
      }

    } catch (error) {
      console.error('系统资源检查失败:', error.message);
      result.error = error.message;
    }

    return result;
  }

  /**
   * 检查安全设置
   * @returns {Promise<Object>} 安全检查结果
   */
  async checkSecuritySettings() {
    const result = {
      firewall: {},
      ssh: {},
      updates: {},
      timestamp: new Date().toISOString()
    };

    if (!this.ssh.isConnected()) {
      result.error = 'SSH连接未建立';
      return result;
    }

    try {
      // 防火墙状态
      const ufwResult = await this.ssh.execCommand('sudo ufw status | head -1');
      if (ufwResult.code === 0) {
        result.firewall.ufw = {
          status: ufwResult.stdout.includes('active') ? 'active' : 'inactive',
          enabled: ufwResult.stdout.includes('active')
        };
      }

      // SSH配置检查
      const sshdResult = await this.ssh.execCommand('sudo cat /etc/ssh/sshd_config | grep -E "(PermitRootLogin|PasswordAuthentication|Port)"');
      if (sshdResult.code === 0) {
        const sshLines = sshdResult.stdout.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        result.ssh.config = {};
        sshLines.forEach(line => {
          const [key, value] = line.trim().split(/\s+/);
          result.ssh.config[key] = value;
        });
      }

      // 检查SSH端口
      const sshPortResult = await this.ssh.execCommand('sudo netstat -tlnp | grep :22');
      result.ssh.port22open = sshPortResult.stdout.includes(':22');

      // 系统更新
      const updateResult = await this.ssh.execCommand('apt list --upgradable 2>/dev/null | wc -l');
      if (updateResult.code === 0) {
        const updateCount = parseInt(updateResult.stdout.trim()) - 1; // 减去标题行
        result.updates = {
          available: updateCount,
          needsUpdate: updateCount > 0
        };
      }

    } catch (error) {
      console.error('安全检查失败:', error.message);
      result.error = error.message;
    }

    return result;
  }

  /**
   * 根据检查结果生成建议
   * @param {Object} results - 检查结果
   * @returns {Array} 建议列表
   */
  generateRecommendations(results) {
    const recommendations = [];

    // 网络建议
    if (results.network.packetLoss > 10) {
      recommendations.push('检测到网络丢包率较高，建议检查网络连接质量');
    }

    // 系统资源建议
    if (results.system.disk && !results.system.disk.healthy) {
      recommendations.push(`磁盘使用率过高 (${results.system.disk.usage}%)，建议清理磁盘空间`);
    }

    if (results.system.memory && !results.system.memory.healthy) {
      recommendations.push(`内存使用率过高 (${results.system.memory.usage}%)，建议优化内存使用`);
    }

    if (results.system.cpu && !results.system.cpu.healthy) {
      recommendations.push(`CPU使用率过高 (${results.system.cpu.usage}%)，建议检查高CPU使用的进程`);
    }

    // 安全建议
    if (results.security.firewall && !results.security.firewall.ufw.enabled) {
      recommendations.push('防火墙未启用，建议启用UFW防火墙');
    }

    if (results.security.ssh && results.security.ssh.config) {
      if (results.security.ssh.config.PermitRootLogin === 'yes') {
        recommendations.push('SSH允许root登录，建议禁用root登录以提高安全性');
      }
      if (results.security.ssh.config.PasswordAuthentication === 'yes') {
        recommendations.push('SSH使用密码认证，建议改用密钥认证');
      }
    }

    if (results.security.updates && results.security.updates.needsUpdate) {
      recommendations.push(`有 ${results.security.updates.available} 个系统更新可用，建议及时更新`);
    }

    // Web服务建议
    const webPorts = Object.keys(results.services.web || {});
    const openWebPorts = webPorts.filter(port => results.services.web[port].open);
    if (openWebPorts.length === 0) {
      recommendations.push('未检测到Web服务端口开放，建议检查Web服务器配置');
    }

    return recommendations;
  }

  /**
   * 根据端口号获取服务名称
   * @param {number} port - 端口号
   * @returns {string} 服务名称
   */
  getServiceName(port) {
    const serviceMap = {
      22: 'SSH',
      80: 'HTTP',
      443: 'HTTPS',
      3306: 'MySQL',
      5432: 'PostgreSQL',
      27017: 'MongoDB',
      6379: 'Redis',
      8080: 'HTTP-Alt',
      3000: 'Node.js',
      3001: 'Node.js-Alt'
    };
    
    return serviceMap[port] || 'Unknown';
  }

  /**
   * 包装：与外部接口保持一致
   * @param {Object} connectionConfig
   */
  async inspect(connectionConfig) {
    return this.performFullInspection(connectionConfig);
  }

  /**
   * 快速检查包装方法
   * @param {Object} connectionConfig
   */
  async quickCheck(connectionConfig) {
    const connected = await this.connect(connectionConfig);
    if (!connected) {
      return {
        server: connectionConfig.host,
        status: 'unreachable'
      };
    }

    const system = await this.checkSystemResources();
    await this.disconnect();
    return {
      server: connectionConfig.host,
      status: 'healthy',
      system
    };
  }
}

module.exports = ServerInspector;