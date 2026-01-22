/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies BEFORE importing the module under test
const mockAgentStream = vi.fn();

vi.mock('ai', () => ({
  Experimental_Agent: class {
    model: string;
    system: string;
    tools: Record<string, unknown>;
    stopWhen: unknown[];

    constructor(config: {
      model: string;
      system: string;
      tools: Record<string, unknown>;
      stopWhen?: unknown[];
    }) {
      this.model = config.model;
      this.system = config.system;
      this.tools = config.tools;
      this.stopWhen = config.stopWhen || [];
    }

    stream() {
      return mockAgentStream;
    }
  },
  stepCountIs: (count: number) => ({ type: 'step-count', count }),
  tool: (config: unknown) => config,
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock('@/lib/search/web-search', () => ({
  searchAndContents: vi.fn(),
  getContents: vi.fn(),
}));

vi.mock('@/lib/slack', () => ({
  sendSlackMessageWithButtons: vi.fn(),
}));

vi.mock('@/lib/types', () => ({
  FormSchema: vi.fn(),
  QualificationSchema: vi.fn(),
  qualificationSchema: {
    category: 'string',
    reason: 'string',
  },
}));

// Import after mocking
import {
  qualify,
  writeEmail,
  humanFeedback,
  sendEmail,
  fetchUrl,
  crmSearch,
  techStackAnalysis,
  researchAgent,
} from '../services';

import { generateObject, generateText } from 'ai';
import { searchAndContents, getContents } from '@/lib/search/web-search';
import { sendSlackMessageWithButtons } from '@/lib/slack';

describe('Services Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_CHANNEL_ID = 'test-channel-id';
  });

  describe('qualify', () => {
    it('should qualify a lead successfully', async () => {
      const mockLead = {
        email: 'test@example.com',
        name: 'Test Company',
        message: 'We need AI solutions for our business',
      };

      const mockResearch = 'Test research data';

      const mockQualification = {
        category: 'QUALIFIED',
        reason: 'High potential lead with strong interest',
      };

      vi.mocked(generateObject).mockResolvedValue({
        object: mockQualification,
      } as never);

      const result = await qualify(mockLead, mockResearch);

      expect(result).toEqual(mockQualification);
      expect(generateObject).toHaveBeenCalledWith({
        model: 'openai/gpt-5',
        schema: expect.any(Object),
        prompt: expect.stringContaining('Test Company'),
      });
    });

    it('should handle AI generation errors', async () => {
      const mockLead = {
        email: 'test@example.com',
        name: 'Test',
        message: 'Test message',
      };
      const mockResearch = 'Research';

      vi.mocked(generateObject).mockRejectedValue(
        new Error('AI generation failed')
      );

      await expect(qualify(mockLead, mockResearch)).rejects.toThrow(
        'AI generation failed'
      );
    });

    it('should include lead data and research in prompt', async () => {
      const mockLead = {
        email: 'john@acme.com',
        name: 'John Doe',
        company: 'Acme Corp',
        message: 'Looking for technology solutions',
      };
      const mockResearch = 'Acme Corp is a leading technology company';

      vi.mocked(generateObject).mockResolvedValue({
        object: { category: 'FOLLOW_UP' as const, reason: 'Good fit' },
      } as never);

      await qualify(mockLead, mockResearch);

      const callArgs = vi.mocked(generateObject).mock.calls[0];
      expect(callArgs[0].prompt).toContain('Acme Corp');
      expect(callArgs[0].prompt).toContain('John Doe');
      expect(callArgs[0].prompt).toContain('Acme Corp is a leading technology company');
    });

    it('should handle minimal lead data', async () => {
      const mockLead = {
        email: 'test@example.com',
        name: 'Test User',
        message: 'Test message for qualification',
      };
      const mockResearch = 'Some research';

      vi.mocked(generateObject).mockResolvedValue({
        object: { category: 'UNQUALIFIED' as const, reason: 'Insufficient data' },
      } as never);

      const result = await qualify(mockLead, mockResearch);

      expect(result.category).toBe('UNQUALIFIED');
    });
  });

  describe('writeEmail', () => {
    it('should write an email based on research and qualification', async () => {
      const mockResearch = 'Company is looking for AI solutions';
      const mockQualification = {
        category: 'QUALIFIED',
        reason: 'High urgency project',
      };

      const mockEmail = 'Subject: AI Solutions for Your Company\n\nDear ...';

      vi.mocked(generateText).mockResolvedValue({
        text: mockEmail,
      } as never);

      const result = await writeEmail(mockResearch, mockQualification);

      expect(result).toBe(mockEmail);
      expect(generateText).toHaveBeenCalledWith({
        model: 'openai/gpt-5',
        prompt: expect.stringContaining('QUALIFIED'),
      });
    });

    it('should handle email generation errors', async () => {
      const mockResearch = 'Research';
      const mockQualification = {
        category: 'SUPPORT',
        reason: 'Reason',
      };

      vi.mocked(generateText).mockRejectedValue(
        new Error('Email generation failed')
      );

      await expect(
        writeEmail(mockResearch, mockQualification)
      ).rejects.toThrow('Email generation failed');
    });

    it('should include qualification category in prompt', async () => {
      const mockResearch = 'Research data';
      const mockQualification = {
        category: 'FOLLOW_UP',
        reason: 'Large enterprise opportunity',
      };

      vi.mocked(generateText).mockResolvedValue({
        text: 'Email content',
      } as never);

      await writeEmail(mockResearch, mockQualification);

      const callArgs = vi.mocked(generateText).mock.calls[0];
      expect(callArgs[0].prompt).toContain('FOLLOW_UP');
    });
  });

  describe('humanFeedback', () => {
    it('should send formatted message to Slack', async () => {
      const mockResearch = 'Company research data';
      const mockEmail = 'test@example.com';
      const mockQualification = {
        category: 'QUALIFIED',
        reason: 'High potential',
      };

      vi.mocked(sendSlackMessageWithButtons).mockResolvedValue({
        ts: '1234567890.123456',
        channel: 'test-channel-id',
      } as never);

      await humanFeedback(mockResearch, mockEmail, mockQualification);

      expect(sendSlackMessageWithButtons).toHaveBeenCalledWith(
        'test-channel-id',
        expect.stringContaining('*New Lead Qualification*')
      );
    });

    it('should truncate long research text to 500 chars', async () => {
      const longResearch = 'x'.repeat(1000);
      const mockEmail = 'test@example.com';
      const mockQualification = {
        category: 'FOLLOW_UP',
        reason: 'Test reason',
      };

      vi.mocked(sendSlackMessageWithButtons).mockResolvedValue({
        ts: '1234567890.123456',
        channel: 'test-channel-id',
      } as never);

      await humanFeedback(longResearch, mockEmail, mockQualification);

      const messageArg = vi.mocked(sendSlackMessageWithButtons).mock.calls[0][1];
      expect(messageArg).toContain('...'); // Truncation indicator
      expect(messageArg.length).toBeLessThan(longResearch.length);
    });

    it('should include all qualification details in message', async () => {
      const mockResearch = 'Research';
      const mockEmail = 'contact@company.com';
      const mockQualification = {
        category: 'SUPPORT',
        reason: 'Fortune 500 company with $5M budget',
      };

      vi.mocked(sendSlackMessageWithButtons).mockResolvedValue({
        ts: '1234567890.123456',
        channel: 'test-channel-id',
      } as never);

      await humanFeedback(mockResearch, mockEmail, mockQualification);

      const messageArg = vi.mocked(sendSlackMessageWithButtons).mock.calls[0][1];
      expect(messageArg).toContain('contact@company.com');
      expect(messageArg).toContain('SUPPORT');
      expect(messageArg).toContain('Fortune 500 company with $5M budget');
    });

    it('should use SLACK_CHANNEL_ID from environment', async () => {
      process.env.SLACK_CHANNEL_ID = 'custom-channel';

      const mockResearch = 'Research';
      const mockEmail = 'test@example.com';
      const mockQualification = {
        category: 'UNQUALIFIED',
        reason: 'Test',
      };

      vi.mocked(sendSlackMessageWithButtons).mockResolvedValue({
        ts: '1234567890.123456',
        channel: 'custom-channel',
      } as never);

      await humanFeedback(mockResearch, mockEmail, mockQualification);

      expect(sendSlackMessageWithButtons).toHaveBeenCalledWith(
        'custom-channel',
        expect.any(String)
      );
    });

    it('should handle Slack API errors', async () => {
      const mockResearch = 'Research';
      const mockEmail = 'test@example.com';
      const mockQualification = {
        category: 'QUALIFIED',
        reason: 'Test',
      };

      vi.mocked(sendSlackMessageWithButtons).mockRejectedValue(
        new Error('Slack API error')
      );

      await expect(
        humanFeedback(mockResearch, mockEmail, mockQualification)
      ).rejects.toThrow('Slack API error');
    });
  });

  describe('sendEmail', () => {
    it('should be a placeholder function that does nothing', async () => {
      const mockEmail = 'Test email content';

      // Function should not throw
      await expect(sendEmail(mockEmail)).resolves.toBeUndefined();
    });

    it('should accept email string parameter', async () => {
      const emailContent = 'Subject: Test\n\nBody';

      await expect(sendEmail(emailContent)).resolves.toBeUndefined();
    });
  });

  describe('fetchUrl tool', () => {
    it('should fetch visible text from URL as Markdown', async () => {
      const mockUrl = 'https://example.com';
      const mockContent = '# Example Page\n\nThis is the content.';

      vi.mocked(getContents).mockResolvedValue(mockContent as never);

      const result = await fetchUrl.execute({ url: mockUrl });

      expect(result).toBe(mockContent);
      expect(getContents).toHaveBeenCalledWith(mockUrl, { text: true });
    });

    it('should handle invalid URLs', async () => {
      const invalidUrl = 'not-a-url';

      vi.mocked(getContents).mockRejectedValue(
        new Error('Invalid URL')
      );

      await expect(fetchUrl.execute({ url: invalidUrl })).rejects.toThrow(
        'Invalid URL'
      );
    });

    it('should handle network errors', async () => {
      const mockUrl = 'https://unreachable.example.com';

      vi.mocked(getContents).mockRejectedValue(
        new Error('Network error')
      );

      await expect(fetchUrl.execute({ url: mockUrl })).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('crmSearch tool', () => {
    it('should return empty array (placeholder implementation)', async () => {
      const result = await crmSearch.execute({ name: 'Test Company' });

      expect(result).toEqual([]);
    });

    it('should accept company name parameter', async () => {
      const result = await crmSearch.execute({
        name: 'Vercel',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle special characters in company name', async () => {
      const result = await crmSearch.execute({
        name: 'Company & Co., LLC',
      });

      expect(result).toEqual([]);
    });
  });

  describe('techStackAnalysis tool', () => {
    it('should return empty array (placeholder implementation)', async () => {
      const result = await techStackAnalysis.execute({
        domain: 'vercel.com',
      });

      expect(result).toEqual([]);
    });

    it('should accept domain parameter', async () => {
      const result = await techStackAnalysis.execute({
        domain: 'example.com',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle domains without protocol', async () => {
      const result = await techStackAnalysis.execute({
        domain: 'subdomain.example.com',
      });

      expect(result).toEqual([]);
    });
  });

  describe('researchAgent', () => {
    it('should be initialized with correct configuration', () => {
      expect(researchAgent).toBeDefined();
      expect(researchAgent).toHaveProperty('model', 'openai/gpt-5');
      expect(researchAgent).toHaveProperty('system');
      expect(researchAgent).toHaveProperty('tools');
    });

    it('should have system prompt describing researcher role', () => {
      expect(researchAgent.system).toContain('researcher');
      expect(researchAgent.system).toContain('lead');
    });

    it('should have all required tools configured', () => {
      expect(researchAgent.tools).toHaveProperty('search');
      expect(researchAgent.tools).toHaveProperty('queryKnowledgeBase');
      expect(researchAgent.tools).toHaveProperty('fetchUrl');
      expect(researchAgent.tools).toHaveProperty('crmSearch');
      expect(researchAgent.tools).toHaveProperty('techStackAnalysis');
    });

    it('should have stop condition configured', () => {
      expect(researchAgent.stopWhen).toBeDefined();
      expect(Array.isArray(researchAgent.stopWhen)).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing environment variables gracefully', async () => {
      delete process.env.SLACK_CHANNEL_ID;

      const mockResearch = 'Research';
      const mockEmail = 'test@example.com';
      const mockQualification = {
        category: 'QUALIFIED',
        reason: 'Test',
      };

      vi.mocked(sendSlackMessageWithButtons).mockResolvedValue({
        ts: '1234567890.123456',
        channel: '',
      } as never);

      await humanFeedback(mockResearch, mockEmail, mockQualification);

      expect(sendSlackMessageWithButtons).toHaveBeenCalledWith(
        '',
        expect.any(String)
      );
    });

    it('should handle concurrent requests', async () => {
      const mockLeads = [
        {
          email: 'a@example.com',
          name: 'Company A',
          message: 'Message A',
        },
        {
          email: 'b@example.com',
          name: 'Company B',
          message: 'Message B',
        },
      ];

      vi.mocked(generateObject).mockResolvedValue({
        object: { category: 'QUALIFIED' as const, reason: 'Test' },
      } as never);

      const results = await Promise.all(
        mockLeads.map((lead) => qualify(lead, 'research'))
      );

      expect(results).toHaveLength(2);
      expect(generateObject).toHaveBeenCalledTimes(2);
    });
  });
});
