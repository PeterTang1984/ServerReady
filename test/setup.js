// Jest setup file
beforeEach(() => {
  // Mock console methods to reduce noise in tests
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
  jest.spyOn(console, 'warn').mockImplementation();
});

afterEach(() => {
  // Restore console methods
  console.log.mockRestore();
  console.error.mockRestore();
  console.warn.mockRestore();
});