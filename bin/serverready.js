const { Command } = require('commander');
const ServerInspector = require('../src/inspector.js');
const ServerInitializer = require('../src/initializer.js');
const fs = require('fs');
const path = require('path');

const program = new Command();

// Bilingual output helpers
function printENZH(en, zh, level = 'log') {
  if (level === 'error') {
    console.error(`[EN] ${en}`);
    console.error(`[ZH] ${zh}`);
  } else {
    console.log(`[EN] ${en}`);
    console.log(`[ZH] ${zh}`);
  }
}

function printSavedFile(filePath) {
  printENZH(`Result saved to: ${filePath}`, `结果已保存到: ${filePath}`);
}

program
  .name('serverready')
  .description('ServerReady CLI - Intelligent server inspection and initialization tool')
  .version('1.0.0');

// 预检命令
program
  .command('inspect')
  .description('inspect server before deployment')
  .requiredOption('-h, --host <host>', 'server hostname or IP')
  .option('-u, --username <username>', 'SSH username', 'root')
  .option('-p, --password <password>', 'SSH password')
  .option('-P, --port <port>', 'SSH port', '22')
  .option('--private-key <path>', 'path to private key file')
  .option('-o, --output <output>', 'output file path')
  .option('--json', 'output results in JSON format')
  .action(async (options) => {
    printENZH('Starting server inspection...', '开始服务器预检...');
    
    try {
      // 验证连接参数
      if (!options.password && !options.privateKey) {
        printENZH('Error: Password or private key file is required', '错误：必须提供密码或私钥文件', 'error');
        process.exit(1);
      }

      // 读取私钥内容
      let privateKey;
      if (options.privateKey) {
        try {
          privateKey = fs.readFileSync(path.resolve(options.privateKey), 'utf8');
        } catch (error) {
          printENZH(`Error reading private key file: ${error.message}`, `读取私钥文件出错：${error.message}`, 'error');
          process.exit(1);
        }
      }

      const inspector = new ServerInspector();
      const results = await inspector.inspect({
        host: options.host,
        username: options.username,
        password: options.password,
        port: parseInt(options.port),
        privateKey: privateKey
      });

      // 输出结果
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        displayInspectionResults(results);
        
        if (results.recommendations && results.recommendations.length > 0) {
          printENZH('\nRecommendations:', '\n优化建议：');
          results.recommendations.forEach(rec => {
            console.log(`  • ${rec}`);
          });
        }
        
        printENZH('\nInspection completed!', '\n预检完成！');
      }

      // 保存到文件
      if (options.output) {
        const outputData = options.json ? JSON.stringify(results, null, 2) : formatResultsForFile(results);
        fs.writeFileSync(options.output, outputData);
        printSavedFile(options.output);
      }

      // 根据检查结果退出
      if (!results.network.sshAccessible) {
        process.exit(1);
      }

    } catch (error) {
      printENZH(`Inspection failed: ${error.message}`, `预检失败：${error.message}`, 'error');
      process.exit(1);
    }
  });

// 初始化命令
program
  .command('init')
  .description('initialize server')
  .requiredOption('-h, --host <host>', 'server hostname or IP')
  .option('-u, --username <username>', 'SSH username', 'root')
  .option('-p, --password <password>', 'SSH password')
  .option('--private-key <path>', 'path to private key file')
  .option('-P, --port <port>', 'SSH port', '22')
  .option('--web-server <type>', 'web server type (nginx|apache)', 'nginx')
  .option('--database <type>', 'database type (mysql|postgresql)')
  .option('--skip-firewall', 'skip firewall configuration')
  .option('--skip-update', 'skip system update')
  .option('--skip-network', 'skip network optimization')
  .option('--skip-security', 'skip security hardening')
  .option('-o, --output <output>', 'output file path')
  .option('--json', 'output results in JSON format')
  .action(async (options) => {
    printENZH('Starting server initialization...', '开始服务器初始化...');
    
    try {
      // 验证连接参数
      if (!options.password && !options.privateKey) {
        printENZH('Error: Password or private key file is required', '错误：必须提供密码或私钥文件', 'error');
        process.exit(1);
      }

      // 读取私钥内容
      let privateKey;
      if (options.privateKey) {
        try {
          privateKey = fs.readFileSync(path.resolve(options.privateKey), 'utf8');
        } catch (error) {
          printENZH(`Error reading private key file: ${error.message}`, `读取私钥文件出错：${error.message}`, 'error');
          process.exit(1);
        }
      }

      const connectionConfig = {
        host: options.host,
        username: options.username,
        password: options.password,
        privateKey: privateKey,
        port: parseInt(options.port)
      };

      const initOptions = {
        updateSystem: !options.skipUpdate,
        configureFirewall: !options.skipFirewall,
        networkOptimization: !options.skipNetwork,
        securityHardening: !options.skipSecurity,
        webServer: options.webServer ? { type: options.webServer } : null,
        database: options.database ? { type: options.database } : null
      };

      const initializer = new ServerInitializer();
      const results = await initializer.performFullInitialization(connectionConfig, initOptions);

      // 输出结果
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        displayInitializationResults(results);
      }

      // 保存到文件
      if (options.output) {
        const outputData = options.json ? JSON.stringify(results, null, 2) : formatInitResultsForFile(results);
        fs.writeFileSync(options.output, outputData);
        printSavedFile(options.output);
      }

      // 根据初始化结果退出
      if (!results.success) {
        process.exit(1);
      }

    } catch (error) {
      printENZH(`Initialization failed: ${error.message}`, `初始化失败：${error.message}`, 'error');
      process.exit(1);
    }
  });

// 快速检查命令
program
  .command('quick-check')
  .description('quick server status check')
  .requiredOption('-h, --host <host>', 'server hostname or IP')
  .option('-u, --username <username>', 'SSH username', 'root')
  .option('-p, --password <password>', 'SSH password')
  .option('--private-key <path>', 'path to private key file')
  .option('-P, --port <port>', 'SSH port', '22')
  .option('--json', 'output results in JSON format')
  .action(async (options) => {
    printENZH('Performing quick check...', '执行快速检查...');
    
    try {
      // 读取私钥内容
      let privateKey;
      if (options.privateKey) {
        privateKey = fs.readFileSync(path.resolve(options.privateKey), 'utf8');
      }

      const connectionConfig = {
        host: options.host,
        username: options.username,
        password: options.password,
        privateKey: privateKey,
        port: parseInt(options.port)
      };

      const inspector = new ServerInspector();
      const connected = await inspector.connect(connectionConfig);
      
      if (!connected) {
        printENZH('SSH connection failed', 'SSH 连接失败');
        process.exit(1);
      }

      // 快速检查系统资源
      const quick = await inspector.quickCheck(connectionConfig);

      if (options.json) {
        console.log(JSON.stringify(quick, null, 2));
      } else {
        printENZH('Quick check results:', '快速检查结果：');
        if (quick.system && quick.system.disk) {
          console.log(`   Disk usage: ${quick.system.disk.usage}% ${quick.system.disk.healthy ? '(OK)' : '(Warning)'}`);
          console.log(`   磁盘使用率：${quick.system.disk.usage}% ${quick.system.disk.healthy ? '(正常)' : '(警告)'}`);
        }
        if (quick.system && quick.system.memory) {
          console.log(`   Memory usage: ${quick.system.memory.usage}% ${quick.system.memory.healthy ? '(OK)' : '(Warning)'}`);
          console.log(`   内存使用率：${quick.system.memory.usage}% ${quick.system.memory.healthy ? '(正常)' : '(警告)'}`);
        }
        if (quick.system && quick.system.cpu && quick.system.cpu.usage) {
          console.log(`   CPU usage: ${quick.system.cpu.usage.toFixed(1)}% ${quick.system.cpu.healthy ? '(OK)' : '(Warning)'}`);
          console.log(`   CPU 使用率：${quick.system.cpu.usage.toFixed(1)}% ${quick.system.cpu.healthy ? '(正常)' : '(警告)'}`);
        }
      }
      
      await inspector.disconnect();
      
    } catch (error) {
      printENZH(`Quick check failed: ${error.message}`, `快速检查失败：${error.message}`, 'error');
      process.exit(1);
    }
  });

// 基于依赖的自动配置命令
program
  .command('auto-config')
  .description('analyze local project dependencies and auto-config the server')
  .requiredOption('-h, --host <host>', 'server hostname or IP')
  .option('-u, --username <username>', 'SSH username', 'root')
  .option('-p, --password <password>', 'SSH password')
  .option('--private-key <path>', 'path to private key file')
  .option('-P, --port <port>', 'SSH port', '22')
  .option('--project <path>', 'local project path', process.cwd())
  .option('--env <env>', 'environment (dev|test|prod)', 'dev')
  .option('--json', 'output results in JSON format')
  .action(async (options) => {
    printENZH('Analyzing project and auto-configuring server...', '分析项目并自动配置服务器...');

    try {
      if (!options.password && !options.privateKey) {
        console.error('Error: Password or private key file is required');
        process.exit(1);
      }

      let privateKey;
      if (options.privateKey) {
        try {
          privateKey = fs.readFileSync(path.resolve(options.privateKey), 'utf8');
        } catch (error) {
          console.error(`Error reading private key file: ${error.message}`);
          process.exit(1);
        }
      }

      const { MCPServer } = require('../src/mcp-server.js');
      const mcp = new MCPServer();
      const deps = await mcp.analyzeProjectDependencies(path.resolve(options.project));
      const recs = mcp.generateServerRecommendations(deps, options.env);
      const health = mcp.evaluateProjectHealth(deps);
      const security = mcp.scanSecurityIssues(deps);

      const connectionConfig = {
        host: options.host,
        username: options.username,
        password: options.password,
        privateKey: privateKey,
        port: parseInt(options.port)
      };

      const initOptions = {
        updateSystem: true,
        configureFirewall: true,
        networkOptimization: true,
        securityHardening: options.env === 'prod',
        webServer: recs.webServer ? { type: recs.webServer } : null,
        database: recs.database ? { type: recs.database } : null
      };

      const initializer = new ServerInitializer();
      const result = await initializer.initialize(connectionConfig, initOptions);

      const output = {
        project: path.resolve(options.project),
        env: options.env,
        dependencies: deps,
        recommendations: recs,
        health,
        securityIssues: security,
        initializationResult: result,
        timestamp: new Date().toISOString()
      };

      if (options.json) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        printENZH('Recommendations:', '优化建议：');
        console.log(recs);
        displayInitializationResults(result);
      }

      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      printENZH(`Auto-config failed: ${error.message}`, `自动配置失败：${error.message}`, 'error');
      process.exit(1);
    }
  });

/**
 * Display inspection results
 * @param {Object} results - inspection results
 */
function displayInspectionResults(results) {
  printENZH('\nInspection Results:', '\n检查结果：');
  console.log(`Server: ${results.server}`);
  console.log(`服务器：${results.server}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`时间戳：${results.timestamp}`);
  
  if (results.error) {
    printENZH(`Error: ${results.error}`, `错误：${results.error}`);
    return;
  }

  // Network checks
  printENZH('\nNetwork Connectivity:', '\n网络连通性：');
  if (results.network.dnsResolution) {
    console.log(`  DNS Resolution: ${results.network.ipAddress}`);
    console.log(`  DNS 解析：${results.network.ipAddress}`);
  } else {
    printENZH('  DNS Resolution: Failed', '  DNS 解析：失败');
  }
  
  if (results.network.sshAccessible) {
    printENZH('  SSH Accessible: Yes', '  SSH 可访问：是');
  } else {
    printENZH('  SSH Accessible: No', '  SSH 可访问：否');
  }
  
  if (results.network.pingLatency) {
    console.log(`  Latency: ${results.network.pingLatency}ms`);
    console.log(`  延迟：${results.network.pingLatency}ms`);
  }

  // Service ports
  printENZH('\nService Ports:', '\n服务端口：');
  if (results.services.web) {
    printENZH('  Web Services:', '  Web 服务：');
    Object.keys(results.services.web).forEach(port => {
      const service = results.services.web[port];
      const status = service.open ? 'Open' : 'Closed';
      console.log(`    Port ${port} (${service.service}): ${status}`);
      console.log(`    端口 ${port}（${service.service}）：${status === 'Open' ? '开放' : '关闭'}`);
    });
  }

  // System resources
  printENZH('\nSystem Resources:', '\n系统资源：');
  if (results.system.disk) {
    const diskStatus = results.system.disk.healthy ? 'OK' : 'Warning';
    console.log(`  Disk Usage: ${results.system.disk.usage}% ${diskStatus}`);
    console.log(`  磁盘使用率：${results.system.disk.usage}% ${diskStatus === 'OK' ? '正常' : '警告'}`);
  }
  
  if (results.system.memory) {
    const memStatus = results.system.memory.healthy ? 'OK' : 'Warning';
    console.log(`  Memory Usage: ${results.system.memory.usage}% ${memStatus}`);
    console.log(`  内存使用率：${results.system.memory.usage}% ${memStatus === 'OK' ? '正常' : '警告'}`);
  }
  
  if (results.system.cpu) {
    const cpuStatus = results.system.cpu.healthy ? 'OK' : 'Warning';
    console.log(`  CPU Usage: ${results.system.cpu.usage.toFixed(1)}% ${cpuStatus}`);
    console.log(`  CPU 使用率：${results.system.cpu.usage.toFixed(1)}% ${cpuStatus === 'OK' ? '正常' : '警告'}`);
  }
  
  if (results.system.loadAverage) {
    const loadStatus = results.system.loadAverage.healthy ? 'OK' : 'Warning';
    console.log(`  Load Average: ${results.system.loadAverage.value} ${loadStatus}`);
    console.log(`  负载平均值：${results.system.loadAverage.value} ${loadStatus === 'OK' ? '正常' : '警告'}`);
  }

  // Security
  printENZH('\nSecurity:', '\n安全：');
  if (results.security.firewall) {
    console.log(`  Firewall: ${results.security.firewall.status}`);
    console.log(`  防火墙：${results.security.firewall.status}`);
    if (results.security.firewall.rules && results.security.firewall.rules.length > 0) {
      printENZH('  Firewall Rules:', '  防火墙规则：');
      results.security.firewall.rules.forEach(rule => {
        console.log(`    ${rule.port}/${rule.protocol}: ${rule.action}`);
        console.log(`    ${rule.port}/${rule.protocol}：${rule.action}`);
      });
    }
  }
  
  if (results.security.ssh) {
    console.log(`  SSH Config: ${results.security.ssh.status}`);
    console.log(`  SSH 配置：${results.security.ssh.status}`);
    if (results.security.ssh.issues && results.security.ssh.issues.length > 0) {
      printENZH('  SSH Issues:', '  SSH 问题：');
      results.security.ssh.issues.forEach(issue => {
        console.log(`    • ${issue}`);
        console.log(`    • ${issue}`);
      });
    }
  }
}

/**
 * Display initialization results
 * @param {Object} results - initialization results
 */
function displayInitializationResults(results) {
  printENZH('\nInitialization Results:', '\n初始化结果：');
  
  if (results.success) {
    printENZH('Initialization successful', '初始化成功');
  } else {
    printENZH('Initialization failed', '初始化失败');
  }

  if (results.error) {
    printENZH(`Error: ${results.error}`, `错误：${results.error}`);
  }

  if (results.steps && results.steps.length > 0) {
    printENZH('\nInitialization Steps:', '\n初始化步骤：');
    results.steps.forEach(step => {
      const status = step.success ? '✅' : '❌';
      console.log(`  ${status} ${step.name}: ${step.message || ''}`);
      if (step.message) {
        console.log(`  ${status} ${step.name}：${step.message}`);
      }
    });
  }
}

/**
 * Format results for file output
 * @param {Object} results - results to format
 * @returns {string} formatted results
 */
function formatResultsForFile(results) {
  let output = `ServerReady Inspection Report / 服务器预检报告\n`;
  output += `===========================================\n\n`;
  output += `Server: ${results.server} / 服务器：${results.server}\n`;
  output += `Timestamp: ${results.timestamp} / 时间戳：${results.timestamp}\n\n`;
  
  if (results.error) {
    output += `Error: ${results.error}\n\n`;
    return output;
  }

  // Add network info
  output += `Network Connectivity / 网络连通性：\n`;
  output += `- DNS Resolution: ${results.network.dnsResolution ? results.network.ipAddress : 'Failed'}\n`;
  output += `- SSH Accessible: ${results.network.sshAccessible ? 'Yes' : 'No'}\n`;
  if (results.network.pingLatency) {
    output += `- Latency: ${results.network.pingLatency}ms\n`;
  }
  output += '\n';

  // Add system resources
  output += `System Resources / 系统资源：\n`;
  if (results.system.disk) {
    output += `- Disk Usage: ${results.system.disk.usage}% (${results.system.disk.healthy ? 'Healthy' : 'Warning'}) / 磁盘使用率：${results.system.disk.usage}%（${results.system.disk.healthy ? '正常' : '警告'}）\n`;
  }
  if (results.system.memory) {
    output += `- Memory Usage: ${results.system.memory.usage}% (${results.system.memory.healthy ? 'Healthy' : 'Warning'}) / 内存使用率：${results.system.memory.usage}%（${results.system.memory.healthy ? '正常' : '警告'}）\n`;
  }
  if (results.system.cpu) {
    output += `- CPU Usage: ${results.system.cpu.usage.toFixed(1)}% (${results.system.cpu.healthy ? 'Healthy' : 'Warning'}) / CPU 使用率：${results.system.cpu.usage.toFixed(1)}%（${results.system.cpu.healthy ? '正常' : '警告'}）\n`;
  }
  output += '\n';

  // Add recommendations
  if (results.recommendations && results.recommendations.length > 0) {
    output += `Recommendations:\n`;
    results.recommendations.forEach(rec => {
      output += `- ${rec}\n`;
    });
    output += '\n';
  }

  return output;
}

/**
 * Format initialization results for file output
 * @param {Object} results - results to format
 * @returns {string} formatted results
 */
function formatInitResultsForFile(results) {
  let output = `ServerReady Initialization Report / 服务器初始化报告\n`;
  output += `==============================================\n\n`;
  output += `Status: ${results.success ? 'Success' : 'Failed'} / 状态：${results.success ? '成功' : '失败'}\n`;
  output += `Timestamp: ${results.timestamp || new Date().toISOString()} / 时间戳：${results.timestamp || new Date().toISOString()}\n\n`;
  
  if (results.error) {
    output += `Error: ${results.error}\n\n`;
  }

  if (results.steps && results.steps.length > 0) {
    output += `Initialization Steps / 初始化步骤：\n`;
    results.steps.forEach(step => {
      output += `- ${step.name}: ${step.success ? 'Success' : 'Failed'} / ${step.name}：${step.success ? '成功' : '失败'}\n`;
      if (step.message) {
        output += `  ${step.message} / ${step.message}\n`;
      }
    });
    output += '\n';
  }

  return output;
}

// 错误处理
process.on('unhandledRejection', (error) => {
  printENZH(`Unhandled rejection: ${error.message}`, `未处理的异常：${error.message}`, 'error');
  process.exit(1);
});

program.parse();