// ServerReady Configuration
const config = {
  // 服务器连接配置
  ssh: {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 2000
  },
  
  // 网络检查配置
  network: {
    pingTimeout: 5000,
    portTimeout: 3000,
    dnsTimeout: 5000
  },
  
  // 服务检查配置
  services: {
    web: {
      ports: [80, 443, 8080, 3000, 3001],
      timeout: 5000
    },
    database: {
      ports: [3306, 5432, 27017, 6379],
      timeout: 5000
    },
    ssh: {
      port: 22,
      timeout: 5000
    }
  },
  
  // 系统检查配置
  system: {
    diskThreshold: 90, // 磁盘使用率告警阈值 (%)
    memoryThreshold: 90, // 内存使用率告警阈值 (%)
    cpuThreshold: 80, // CPU使用率告警阈值 (%)
    loadAverageThreshold: 2.0 // 负载平均值告警阈值
  },
  
  // 初始化配置
  initialization: {
    webServer: {
      nginx: {
        configPath: '/etc/nginx/nginx.conf',
        sitesPath: '/etc/nginx/sites-available',
        enabledPath: '/etc/nginx/sites-enabled'
      },
      apache: {
        configPath: '/etc/apache2/apache2.conf',
        sitesPath: '/etc/apache2/sites-available',
        enabledPath: '/etc/apache2/sites-enabled'
      }
    },
    database: {
      mysql: {
        configPath: '/etc/mysql/my.cnf',
        dataPath: '/var/lib/mysql'
      },
      postgresql: {
        configPath: '/etc/postgresql',
        dataPath: '/var/lib/postgresql'
      }
    },
    firewall: {
      ufw: {
        configPath: '/etc/default/ufw',
        rulesPath: '/etc/ufw'
      },
      iptables: {
        rulesPath: '/etc/iptables'
      }
    }
  }
};

module.exports = config;