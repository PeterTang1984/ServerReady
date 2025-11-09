const ServerInitializer = require('../src/initializer.js');
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

describe('ServerInitializer', () => {
  let initializer;

  beforeEach(() => {
    initializer = new ServerInitializer();
  });

  afterEach(async () => {
    await initializer.disconnect();
  });

  describe('System Update', () => {
    it('should update system packages', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'Reading package lists... Done', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;

      const result = await initializer.updateSystem();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('output');
      expect(mockConnection.execCommand).toHaveBeenCalledWith('sudo apt update');
      expect(mockConnection.execCommand).toHaveBeenCalledWith('sudo apt upgrade -y');
    });

    it('should install base packages', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'Package installation completed', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;

      const result = await initializer.installBasePackages();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('installed');
      expect(Array.isArray(result.installed)).toBe(true);
    });
  });

  describe('Firewall Configuration', () => {
    it('should configure UFW firewall', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'Firewall is active and enabled', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;

      const result = await initializer.configureFirewall(['22', '80', '443']);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('rules');
      expect(Array.isArray(result.rules)).toBe(true);
    });

    it('should add custom firewall rules', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'Rule added', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;

      const customRules = [
        { port: 8080, protocol: 'tcp', action: 'allow', comment: 'Custom app' }
      ];

      const result = await initializer.configureFirewall(['22'], customRules);
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });
  });

  describe('Web Server Configuration', () => {
    it('should configure Nginx', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'nginx installed successfully', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;

      const result = await initializer.configureWebServer('nginx');
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('should configure Apache', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'apache2 installed successfully', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;

      const result = await initializer.configureWebServer('apache');
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('should handle unsupported web server', async () => {
      const result = await initializer.configureWebServer('unsupported');
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
    });
  });

  describe('Database Configuration', () => {
    it('should configure MySQL', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'MySQL installed and secured', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;

      const result = await initializer.configureDatabase({ type: 'mysql' });
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('databaseType');
      expect(result.databaseType).toBe('mysql');
      expect(result.success).toBe(true);
    });

    it('should configure PostgreSQL', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'PostgreSQL installed and configured', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;

      const result = await initializer.configureDatabase({ type: 'postgresql' });
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('databaseType');
      expect(result.databaseType).toBe('postgresql');
      expect(result.success).toBe(true);
    });

    it('should handle unsupported database', async () => {
      const result = await initializer.configureDatabase({ type: 'unsupported' });
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
    });
  });

  describe('Network Optimization', () => {
    it('should optimize network settings', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'Network settings optimized', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;

      const result = await initializer.optimizeNetwork();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('optimizations');
      expect(Array.isArray(result.optimizations)).toBe(true);
    });
  });

  describe('Security Hardening', () => {
     it('should perform security hardening', async () => {
       const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'Security hardening completed', code: 0 }),
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      initializer.ssh = mockConnection;
 
       const result = await initializer.performSecurityHardening();
       expect(result).toHaveProperty('success');
       expect(result).toHaveProperty('hardening');
       expect(Array.isArray(result.hardening)).toBe(true);
     });
 

  });

  describe('Full Initialization', () => {
    it('should perform full server initialization', async () => {
      // Mock the connect method to avoid SSH timeout
      initializer.connect = jest.fn().mockResolvedValue(true);
      initializer.disconnect = jest.fn().mockResolvedValue(true);
      
      // Mock all the individual methods
      initializer.updateSystem = jest.fn().mockResolvedValue({ success: true });
      initializer.installBasePackages = jest.fn().mockResolvedValue({ success: true });
      initializer.configureFirewall = jest.fn().mockResolvedValue({ success: true });
      initializer.configureWebServer = jest.fn().mockResolvedValue({ success: true });
      initializer.configureDatabase = jest.fn().mockResolvedValue({ success: true });
      initializer.optimizeNetwork = jest.fn().mockResolvedValue({ success: true });
      initializer.performSecurityHardening = jest.fn().mockResolvedValue({ success: true });

      const result = await initializer.performFullInitialization({
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass'
      }, {
        webServer: 'nginx',
        database: { type: 'mysql' }
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('steps');
      expect(Array.isArray(result.steps)).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      initializer.connect = jest.fn().mockResolvedValue(false);

      const result = await initializer.performFullInitialization({
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass'
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
      expect(result.success).toBe(false);
    });

    it('should skip optional steps when configured', async () => {
      const mockConnection = {
        execCommand: jest.fn().mockResolvedValue({ stdout: 'Command executed', code: 0 })
      };
      initializer.ssh = mockConnection;
      initializer.connect = jest.fn().mockResolvedValue(true);
      initializer.disconnect = jest.fn().mockResolvedValue(true);

      const result = await initializer.performFullInitialization({
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass'
      }, {
        configureFirewall: false,
        networkOptimization: false,
        securityHardening: false
      });

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });
  });
});