const { describe, it, expect } = require('@jest/globals');
const request = require('supertest');
const APIServer = require('../src/api.js');

describe('API Server', () => {
  let apiServer;
  let app;

  beforeEach(() => {
    apiServer = new APIServer();
    app = apiServer.app;
  });

  afterEach(async () => {
    if (apiServer.server) {
      await new Promise(resolve => apiServer.server.close(resolve));
    }
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('API Version', () => {
    it('should return API version', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('name', 'ServerReady API');
    });
  });

  describe('Server Inspection', () => {
    it('should inspect server with valid credentials', async () => {
      const mockInspector = {
        inspect: jest.fn().mockResolvedValue({
          server: 'test-server.com',
          timestamp: new Date().toISOString(),
          network: { status: 'ok' },
          system: { status: 'ok' }
        })
      };

      apiServer.inspector = mockInspector;

      const response = await request(app)
        .post('/api/inspect')
        .send({
          host: 'test-server.com',
          username: 'testuser',
          password: 'testpass'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(mockInspector.inspect).toHaveBeenCalledWith({
        host: 'test-server.com',
        username: 'testuser',
        password: 'testpass'
      });
    });

    it('should return error for missing credentials', async () => {
      const response = await request(app)
        .post('/api/inspect')
        .send({
          host: 'test-server.com'
          // missing username and password
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Server Initialization', () => {
    it('should initialize server with valid credentials', async () => {
      const mockInitializer = {
        initialize: jest.fn().mockResolvedValue({
          success: true,
          steps: [
            { name: 'Update System', success: true },
            { name: 'Install Packages', success: true }
          ]
        })
      };

      apiServer.initializer = mockInitializer;

      const response = await request(app)
        .post('/api/init')
        .send({
          host: 'test-server.com',
          username: 'testuser',
          password: 'testpass',
          config: {
            webServer: 'nginx',
            database: 'mysql'
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(mockInitializer.initialize).toHaveBeenCalled();
    });
  });

  describe('Quick Check', () => {
    it('should perform quick server check', async () => {
      const mockInspector = {
        quickCheck: jest.fn().mockResolvedValue({
          server: 'test-server.com',
          status: 'healthy',
          system: { cpu: 25, memory: 60, disk: 40 }
        })
      };

      apiServer.inspector = mockInspector;

      const response = await request(app)
        .post('/api/quick-check')
        .send({
          host: 'test-server.com',
          username: 'testuser',
          password: 'testpass'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Port Check', () => {
    it('should check if port is open', async () => {
      const mockInspector = {
        checkPort: jest.fn().mockResolvedValue(true)
      };

      apiServer.inspector = mockInspector;

      const response = await request(app)
        .post('/api/check-port')
        .send({
          host: 'test-server.com',
          port: 80
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('open', true);
      expect(mockInspector.checkPort).toHaveBeenCalledWith('test-server.com', 80);
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', async () => {
      const response = await request(app)
        .get('/api/config')
        .expect(200);

      expect(response.body).toHaveProperty('ssh');
      expect(response.body).toHaveProperty('network');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('initialization');
    });
  });

  describe('Batch Operations', () => {
    it('should perform batch inspection', async () => {
      const mockInspector = {
        inspect: jest.fn()
          .mockResolvedValueOnce({ server: 'server1.com', status: 'ok' })
          .mockResolvedValueOnce({ server: 'server2.com', status: 'ok' })
      };

      apiServer.inspector = mockInspector;

      const response = await request(app)
        .post('/api/batch')
        .send({
          servers: [
            { host: 'server1.com', username: 'user1', password: 'pass1' },
            { host: 'server2.com', username: 'user2', password: 'pass2' }
          ]
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should handle batch operation errors', async () => {
      const mockInspector = {
        inspect: jest.fn()
          .mockResolvedValueOnce({ server: 'server1.com', status: 'ok' })
          .mockRejectedValueOnce(new Error('Connection failed'))
      };

      apiServer.inspector = mockInspector;

      const response = await request(app)
        .post('/api/batch')
        .send({
          servers: [
            { host: 'server1.com', username: 'user1', password: 'pass1' },
            { host: 'server2.com', username: 'user2', password: 'pass2' }
          ]
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[1]).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      const mockInspector = {
        inspect: jest.fn().mockRejectedValue(new Error('SSH connection failed'))
      };

      apiServer.inspector = mockInspector;

      const response = await request(app)
        .post('/api/inspect')
        .send({
          host: 'test-server.com',
          username: 'testuser',
          password: 'testpass'
        })
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid JSON requests', async () => {
      const response = await request(app)
        .post('/api/inspect')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/inspect')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });
});