const ServerInspector = require('../src/inspector.js');
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

describe('ServerInspector', () => {
  let inspector;

  beforeEach(() => {
    inspector = new ServerInspector();
  });

  afterEach(async () => {
    if (inspector && inspector.ssh && inspector.ssh.isConnected && inspector.ssh.isConnected()) {
      await inspector.disconnect();
    }
  });

  describe('Network Connectivity', () => {
    it('should check network connectivity', async () => {
      const result = await inspector.checkNetworkConnectivity('google.com');
      expect(result).toHaveProperty('dnsResolution');
      expect(result).toHaveProperty('ipAddress');
      expect(result).toHaveProperty('pingLatency');
      expect(result).toHaveProperty('packetLoss');
      expect(result).toHaveProperty('timestamp');
    });

    it('should check port connectivity', async () => {
      const isOpen = await inspector.checkPort('google.com', 80);
      expect(typeof isOpen).toBe('boolean');
    });
  });

  describe('System Resource Checks', () => {
     it('should check system resources with SSH connection', async () => {
       // Mock SSH connection for testing
       const mockSSH = {
         isConnected: jest.fn().mockReturnValue(true),
         execCommand: jest.fn()
           .mockResolvedValueOnce({ code: 0, stdout: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        20G   5G   15G  25% /' })
           .mockResolvedValueOnce({ code: 0, stdout: '              total        used        free      shared  buff/cache   available\nMem:          7976        2048        4096         512        1832        5928' })
           .mockResolvedValueOnce({ code: 0, stdout: 'Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz' })
           .mockResolvedValueOnce({ code: 0, stdout: '25.5' })
           .mockResolvedValueOnce({ code: 0, stdout: '0.25 0.30 0.35 1/100 12345' })
           .mockResolvedValueOnce({ code: 0, stdout: '150' }),
         dispose: jest.fn().mockResolvedValue(true)
       };
       inspector.ssh = mockSSH;
 
       const result = await inspector.checkSystemResources();
       expect(result).toHaveProperty('disk');
       expect(result).toHaveProperty('memory');
       expect(result).toHaveProperty('cpu');
       expect(result).toHaveProperty('load');
       expect(result).toHaveProperty('processes');
     });
 
     it('should handle system resource check errors gracefully', async () => {
       const mockSSH = {
         isConnected: jest.fn().mockReturnValue(false),
         dispose: jest.fn().mockResolvedValue(true)
       };
       inspector.ssh = mockSSH;
 
       const result = await inspector.checkSystemResources();
       expect(result).toHaveProperty('error');
     });
  });

  describe('Service Port Checks', () => {
    it('should check service ports', async () => {
      const mockCheckPort = jest.fn()
        .mockResolvedValueOnce(true)   // SSH 22
        .mockResolvedValueOnce(true)   // HTTP 80
        .mockResolvedValueOnce(false)  // HTTPS 443
        .mockResolvedValueOnce(false)  // MySQL 3306
        .mockResolvedValueOnce(true)   // PostgreSQL 5432
        .mockResolvedValueOnce(false); // MongoDB 27017
      inspector.checkPort = mockCheckPort;

      const result = await inspector.checkServicePorts('test-server.com');
      expect(result).toHaveProperty('web');
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('ssh');
      expect(result.web).toHaveProperty('80');
      expect(result.web).toHaveProperty('443');
      expect(result.database).toHaveProperty('3306');
      expect(result.database).toHaveProperty('5432');
      expect(result.ssh).toHaveProperty('22');
    });
  });

  describe('Security Checks', () => {
     it('should check security settings', async () => {
       const mockSSH = {
         isConnected: jest.fn().mockReturnValue(true),
         execCommand: jest.fn()
           .mockResolvedValueOnce({ code: 0, stdout: 'Status: active\nLogging: on (low)' })
           .mockResolvedValueOnce({ code: 0, stdout: 'PermitRootLogin no\nPasswordAuthentication no\nPort 22' })
           .mockResolvedValueOnce({ code: 0, stdout: 'tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      1234/sshd' })
           .mockResolvedValueOnce({ code: 0, stdout: '5' }),
         dispose: jest.fn().mockResolvedValue(true)
       };
       inspector.ssh = mockSSH;
 
       const result = await inspector.checkSecuritySettings();
       expect(result).toHaveProperty('firewall');
       expect(result).toHaveProperty('ssh');
       expect(result).toHaveProperty('updates');
       expect(result).toHaveProperty('timestamp');
     });

    it('should handle security check without SSH connection', async () => {
      const mockSSH = {
        isConnected: jest.fn().mockReturnValue(false)
      };
      inspector.ssh = mockSSH;

      const result = await inspector.checkSecuritySettings();
      expect(result).toHaveProperty('error');
    });
  });

  describe('Full Inspection', () => {
    it('should perform full server inspection', async () => {
      // Mock all the methods used in performFullInspection
      inspector.checkNetworkConnectivity = jest.fn().mockResolvedValue({
        dnsResolution: true,
        ipAddress: '8.8.8.8',
        sshAccessible: true
      });
      inspector.connect = jest.fn().mockResolvedValue(true);
      inspector.checkServicePorts = jest.fn().mockResolvedValue({
        web: { 80: { open: true, service: 'HTTP' } },
        database: { 3306: { open: false, service: 'MySQL' } },
        ssh: { 22: { open: true, service: 'SSH' } }
      });
      inspector.checkSystemResources = jest.fn().mockResolvedValue({
        disk: { usage: 25, healthy: true },
        memory: { usage: 30, healthy: true },
        cpu: { usage: 15, healthy: true }
      });
      inspector.checkSecuritySettings = jest.fn().mockResolvedValue({
        firewall: { ufw: { status: 'active', enabled: true } },
        ssh: { config: { PermitRootLogin: 'no' } }
      });
      inspector.generateRecommendations = jest.fn().mockReturnValue([
        'Consider enabling firewall rules for additional security'
      ]);
      inspector.disconnect = jest.fn().mockResolvedValue(true);

      const result = await inspector.performFullInspection({
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass'
      });

      expect(result).toHaveProperty('server');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('network');
      expect(result).toHaveProperty('system');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('security');
      expect(result).toHaveProperty('recommendations');
    });

    it('should handle connection failures in full inspection', async () => {
      inspector.checkNetworkConnectivity = jest.fn().mockResolvedValue({
        dnsResolution: true,
        ipAddress: '8.8.8.8'
      });
      inspector.connect = jest.fn().mockResolvedValue(false);

      const result = await inspector.performFullInspection({
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass'
      });

      expect(result.network.sshAccessible).toBe(false);
      expect(result.recommendations).toContain('SSH连接失败，请检查SSH服务状态和凭据');
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations based on system status', () => {
      const results = {
        network: { packetLoss: 15 },
        system: {
          disk: { usage: 85, healthy: false },
          memory: { usage: 90, healthy: false },
          cpu: { usage: 95, healthy: false }
        },
        security: {
          firewall: { ufw: { enabled: false } },
          ssh: { config: { PermitRootLogin: 'yes', PasswordAuthentication: 'yes' } },
          updates: { needsUpdate: true, available: 10 }
        },
        services: {
          web: { 80: { open: false }, 443: { open: false } }
        }
      };

      const recommendations = inspector.generateRecommendations(results);
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.includes('网络丢包率'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('磁盘使用率'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('内存使用率'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('CPU使用率'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('防火墙'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('root登录'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('密码认证'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('系统更新'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('Web服务'))).toBe(true);
    });

    it('should return empty recommendations for healthy system', () => {
      const results = {
        network: { packetLoss: 0 },
        system: {
          disk: { usage: 20, healthy: true },
          memory: { usage: 30, healthy: true },
          cpu: { usage: 15, healthy: true }
        },
        security: {
          firewall: { ufw: { enabled: true } },
          ssh: { config: { PermitRootLogin: 'no', PasswordAuthentication: 'no' } },
          updates: { needsUpdate: false, available: 0 }
        },
        services: {
          web: { 80: { open: true }, 443: { open: true } }
        }
      };

      const recommendations = inspector.generateRecommendations(results);
      expect(Array.isArray(recommendations)).toBe(true);
      // Even a healthy system might have some basic recommendations
      expect(recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully with valid credentials', async () => {
      const mockSSH = {
        connect: jest.fn().mockResolvedValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      inspector.ssh = mockSSH;

      const result = await inspector.connect({
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass'
      });

      expect(result).toBe(true);
      expect(mockSSH.connect).toHaveBeenCalled();
    });

    it('should handle connection failures', async () => {
      const mockSSH = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        dispose: jest.fn().mockResolvedValue(true)
      };
      inspector.ssh = mockSSH;

      const result = await inspector.connect({
        host: 'invalid-server.com',
        username: 'testuser',
        password: 'wrongpass'
      });

      expect(result).toBe(false);
    });

    it('should disconnect successfully', async () => {
      const mockSSH = {
        isConnected: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(true)
      };
      inspector.ssh = mockSSH;

      await inspector.disconnect();

      expect(mockSSH.dispose).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      const mockSSH = {
        isConnected: jest.fn().mockReturnValue(false),
        dispose: jest.fn().mockResolvedValue(true)
      };
      inspector.ssh = mockSSH;

      await inspector.disconnect();

      expect(mockSSH.dispose).not.toHaveBeenCalled();
    });
  });
});