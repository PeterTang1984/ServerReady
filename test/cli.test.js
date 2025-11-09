const { describe, it, expect } = require('@jest/globals');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('CLI Integration Tests', () => {
  const cliPath = path.join(__dirname, '..', 'bin', 'serverready.js');
  
  beforeAll(() => {
    // Ensure the CLI script is executable
    if (process.platform !== 'win32') {
      fs.chmodSync(cliPath, '755');
    }
  });

  describe('Help Command', () => {
    it('should show help information', () => {
      const output = execSync(`node "${cliPath}" --help`, { encoding: 'utf8' });
      expect(output).toContain('ServerReady CLI');
      expect(output).toContain('inspect');
      expect(output).toContain('init');
      expect(output).toContain('quick-check');
    });

    it('should show version information', () => {
      const output = execSync(`node "${cliPath}" --version`, { encoding: 'utf8' });
      expect(output.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Inspect Command', () => {
    it('should show error for missing required arguments', () => {
      try {
        execSync(`node "${cliPath}" inspect --host test.com`, { encoding: 'utf8' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.stderr || error.stdout).toContain('required');
      }
    });

    it('should accept valid inspect arguments', () => {
      // This test would require a real server to connect to
      // For now, we just verify the command structure is accepted
      const output = execSync(`node "${cliPath}" inspect --help`, { encoding: 'utf8' });
      expect(output).toContain('--host');
      expect(output).toContain('--username');
      expect(output).toContain('--password');
      expect(output).toContain('--port');
    });
  });

  describe('Init Command', () => {
    it('should show init command help', () => {
      const output = execSync(`node "${cliPath}" init --help`, { encoding: 'utf8' });
      expect(output).toContain('--host');
      expect(output).toContain('--username');
      expect(output).toContain('--password');
      expect(output).toContain('--web-server');
      expect(output).toContain('--database');
    });

    it('should show available web server options', () => {
      const output = execSync(`node "${cliPath}" init --help`, { encoding: 'utf8' });
      expect(output).toContain('nginx');
      expect(output).toContain('apache');
    });

    it('should show available database options', () => {
      const output = execSync(`node "${cliPath}" init --help`, { encoding: 'utf8' });
      expect(output).toContain('mysql');
      expect(output).toContain('postgresql');
    });
  });

  describe('Quick Check Command', () => {
    it('should show quick-check command help', () => {
      const output = execSync(`node "${cliPath}" quick-check --help`, { encoding: 'utf8' });
      expect(output).toContain('--host');
      expect(output).toContain('--username');
      expect(output).toContain('--password');
    });
  });

  describe('Configuration', () => {
    it('should load configuration from file', () => {
      const configPath = path.join(__dirname, '..', 'config', 'config.js');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const config = require(configPath);
      expect(config).toHaveProperty('ssh');
      expect(config).toHaveProperty('network');
      expect(config).toHaveProperty('services');
      expect(config).toHaveProperty('system');
      expect(config).toHaveProperty('initialization');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid commands gracefully', () => {
      try {
        execSync(`node "${cliPath}" invalid-command`, { encoding: 'utf8' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.stderr).toContain('error');
      }
    });

    it('should provide helpful error messages', () => {
      try {
        execSync(`node "${cliPath}" inspect`, { encoding: 'utf8' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.stderr).toContain('required option');
      }
    });
  });

  describe('Output Formatting', () => {
    it('should format output consistently', () => {
      const output = execSync(`node "${cliPath}" --help`, { encoding: 'utf8' });
      expect(output).toContain('Usage:');
      expect(output).toContain('Options:');
      expect(output).toContain('Commands:');
    });
  });
});