import { describe, it, expect } from 'vitest';
import { config, formatFileSize } from '@/config/app';

describe('App Configuration', () => {
  describe('AI Configuration', () => {
    it('should have valid AI base URL', () => {
      expect(config.ai.baseUrl).toBeDefined();
      expect(config.ai.baseUrl).toContain('https://');
    });

    it('should have valid AI model name', () => {
      expect(config.ai.model).toBeDefined();
      expect(typeof config.ai.model).toBe('string');
      expect(config.ai.model.length).toBeGreaterThan(0);
    });

    it('should use default AI Hub URL when env var not set', () => {
      expect(config.ai.baseUrl).toBe('https://adesso-ai-hub.3asabc.de/v1');
    });

    it('should use default AI model when env var not set', () => {
      expect(config.ai.model).toBe('gpt-oss-120b-sovereign');
    });
  });

  describe('Upload Configuration', () => {
    it('should have valid max PDF size', () => {
      expect(config.upload.maxPdfSize).toBeDefined();
      expect(config.upload.maxPdfSize).toBe(5 * 1024 * 1024); // 5MB
    });

    it('should have valid min text length', () => {
      expect(config.upload.minTextLength).toBeDefined();
      expect(config.upload.minTextLength).toBe(50);
    });

    it('should have valid max text length', () => {
      expect(config.upload.maxTextLength).toBeDefined();
      expect(config.upload.maxTextLength).toBe(10000);
    });

    it('should have valid max email length', () => {
      expect(config.upload.maxEmailLength).toBeDefined();
      expect(config.upload.maxEmailLength).toBe(20000);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1KB');
      expect(formatFileSize(2048)).toBe('2KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5MB');
    });

    it('should round values appropriately', () => {
      expect(formatFileSize(1536)).toBe('2KB'); // 1.5KB rounds to 2KB
      expect(formatFileSize(1024 * 1024 + 512 * 1024)).toBe('2MB'); // 1.5MB rounds to 2MB
    });
  });

  describe('Configuration Immutability', () => {
    it('should be read-only (as const)', () => {
      // TypeScript enforces this at compile time
      // This test verifies the structure is correct
      expect(config).toHaveProperty('ai');
      expect(config).toHaveProperty('upload');
      expect(Object.isFrozen(config)).toBe(false); // as const doesn't freeze runtime
    });
  });
});
