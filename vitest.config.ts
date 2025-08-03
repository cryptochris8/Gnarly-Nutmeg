import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'assets/',
        'dev/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts' // Exclude main entry point from coverage for now
      ]
    },
    testTimeout: 30000, // 30 seconds for game logic tests
    hookTimeout: 30000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/assets/**',
      '**/dev/**'
    ]
  },
  resolve: {
    alias: {
      '@': './src',
      '@utils': './utils',
      '@types': './types', 
      '@config': './config',
      '@abilities': './abilities',
      '@entities': './entities',
      '@state': './state'
    }
  }
});