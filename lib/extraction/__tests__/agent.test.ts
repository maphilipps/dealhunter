/**
 * Extraction Agent Tests
 *
 * Tests for AI-powered requirement extraction from bid documents:
 * - extractRequirements (basic extraction)
 * - runExtractionWithStreaming (extraction with progress events)
 * - buildExtractionPrompt (prompt generation)
 * - getEmptyRequirements (error handling)
 * - JSON cleaning and validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/ai/config', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/streaming/event-types', () => ({
  AgentEventType: {
    AGENT_PROGRESS: 'AGENT_PROGRESS',
    ERROR: 'ERROR',
  },
}));

import {
  extractRequirements,
  runExtractionWithStreaming,
  type ExtractionInput,
  type ExtractionOutput,
} from '../agent';

import { openai } from '@/lib/ai/config';
import { AgentEventType } from '@/lib/streaming/event-types';

describe('Extraction Agent', () => {
  const mockEmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockEmit).mockReset();
  });

  describe('extractRequirements', () => {
    const mockAIResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              customerName: 'Test Customer AG',
              industry: 'Technology',
              companySize: 'medium',
              procurementType: 'private',
              companyLocation: 'Berlin',
              websiteUrls: [
                {
                  url: 'https://test-customer.de',
                  type: 'primary',
                  extractedFromDocument: true,
                },
              ],
              projectDescription: 'Modern web platform development',
              projectName: 'Platform 2025',
              technologies: ['React', 'Node.js', 'Drupal'],
              scope: 'Full-stack development',
              budgetRange: {
                min: 75000,
                max: 100000,
                currency: 'EUR',
                confidence: 85,
                rawText: 'Budget ca. 75-100k EUR',
              },
              timeline: '6 months',
              teamSize: 5,
              submissionDeadline: '2025-03-15',
              submissionTime: '14:00',
              cmsConstraints: {
                required: ['Drupal'],
                flexibility: 'rigid',
                confidence: 90,
                rawText: 'Must use Drupal',
              },
              contacts: [
                {
                  name: 'Max Mustermann',
                  role: 'CTO',
                  email: 'm.mustermann@test-customer.de',
                  category: 'decision_maker',
                  confidence: 95,
                },
              ],
              requiredDeliverables: [
                {
                  name: 'Concept Paper',
                  description: 'Detailed concept documentation',
                  deadline: '2025-02-28',
                  mandatory: true,
                  confidence: 100,
                },
              ],
              keyRequirements: ['High performance', 'Mobile first'],
              contactPerson: 'Max Mustermann',
              contactEmail: 'm.mustermann@test-customer.de',
              confidenceScore: 0.85,
            }),
          },
        },
      ],
    };

    it('should extract requirements from PDF text successfully', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(mockAIResponse as never);

      const input: ExtractionInput = {
        rawText: 'Project for Test Customer AG...',
        inputType: 'pdf',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      expect(result.requirements.customerName).toBe('Test Customer AG');
      expect(result.requirements.technologies).toContain('React');
      expect(result.requirements.budgetRange?.min).toBe(75000);
      expect(result.requirements.cmsConstraints?.required).toContain('Drupal');
      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4.5',
          temperature: 0.3,
        })
      );
    });

    it('should extract requirements from email with metadata', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(mockAIResponse as never);

      const input: ExtractionInput = {
        rawText: 'Project inquiry...',
        inputType: 'email',
        metadata: {
          from: 'sender@example.com',
          subject: 'Project Proposal 2025',
          date: '2025-01-15',
        },
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      expect(openai.chat.completions.create).toHaveBeenCalled();
      const promptArg = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
      expect(promptArg.messages[1].content).toContain('EMAIL METADATA:');
      expect(promptArg.messages[1].content).toContain('From: sender@example.com');
      expect(promptArg.messages[1].content).toContain('Subject: Project Proposal 2025');
    });

    it('should extract requirements from freetext', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(mockAIResponse as never);

      const input: ExtractionInput = {
        rawText: 'Need a web application...',
        inputType: 'freetext',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      const promptArg = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
      expect(promptArg.messages[1].content).toContain('INPUT TYPE: FREETEXT');
    });

    it('should clean JSON response with markdown code blocks', async () => {
      const responseWithMarkdown = {
        choices: [
          {
            message: {
              content: '```json\n{"customerName": "Test AG", "projectDescription": "Test", "technologies": [], "keyRequirements": [], "confidenceScore": 0.8}\n```',
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithMarkdown as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'freetext',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      expect(result.requirements.customerName).toBe('Test AG');
    });

    it('should clean JSON response with non-JSON prefix', async () => {
      const responseWithPrefix = {
        choices: [
          {
            message: {
              content: 'Here is the result:\n{"customerName": "Test AG", "projectDescription": "Test", "technologies": [], "keyRequirements": [], "confidenceScore": 0.8}',
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithPrefix as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'freetext',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      expect(result.requirements.customerName).toBe('Test AG');
    });

    it('should handle empty AI response', async () => {
      const emptyResponse = {
        choices: [{ message: { content: null } }],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(emptyResponse as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'freetext',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(false);
      expect(result.requirements.customerName).toBe('');
      expect(result.requirements.confidenceScore).toBe(0);
      expect(result.error).toBeDefined();
    });

    it('should handle AI API errors gracefully', async () => {
      vi.mocked(openai.chat.completions.create).mockRejectedValueOnce(new Error('API rate limit') as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit');
      expect(result.requirements.confidenceScore).toBe(0);
    });

    it('should handle invalid JSON response', async () => {
      const invalidJSONResponse = {
        choices: [
          {
            message: {
              content: 'This is not valid JSON at all',
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(invalidJSONResponse as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'freetext',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle schema validation errors', async () => {
      const invalidSchemaResponse = {
        choices: [
          {
            message: {
              content: '{"customerName": 123, "confidenceScore": "invalid"}',
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(invalidSchemaResponse as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'freetext',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should add extractedAt timestamp to requirements', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(mockAIResponse as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      expect(result.requirements.extractedAt).toBeDefined();
      expect(new Date(result.requirements.extractedAt)).toBeInstanceOf(Date);
    });
  });

  describe('runExtractionWithStreaming', () => {
    const mockAIResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              customerName: 'Streaming Test AG',
              projectDescription: 'Streaming test project',
              technologies: ['TypeScript'],
              keyRequirements: ['Fast performance'],
              contacts: [
                {
                  name: 'Test User',
                  role: 'Manager',
                  category: 'influencer',
                  confidence: 80,
                },
              ],
              confidenceScore: 0.9,
            }),
          },
        },
      ],
    };

    it('should emit progress events during extraction', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(mockAIResponse as never);

      const input: ExtractionInput = {
        rawText: 'Test content for streaming',
        inputType: 'pdf',
      };

      const result = await runExtractionWithStreaming(input, mockEmit);

      expect(result.success).toBe(true);
      expect(mockEmit).toHaveBeenCalledTimes(4); // Progress events

      // Check first progress event (analyzing document)
      const firstCall = vi.mocked(mockEmit).mock.calls[0]?.[0];
      expect(firstCall).toEqual({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: 'Extraktion',
          message: 'Analysiere PDF-Dokument...',
        },
      });

      // Check second progress event (starting extraction)
      expect(mockEmit).toHaveBeenNthCalledWith(2, {
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: 'Extraktion',
          message: 'Starte AI-Extraktion der Anforderungen...',
        },
      });

      // Check third progress event (validating)
      expect(mockEmit).toHaveBeenNthCalledWith(3, {
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: 'Extraktion',
          message: 'Validiere extrahierte Daten...',
        },
      });

      // Check final progress event (summary)
      expect(mockEmit).toHaveBeenNthCalledWith(4, {
        type: AgentEventType.AGENT_PROGRESS,
        data: expect.objectContaining({
          agent: 'Extraktion',
          message: expect.stringContaining('Extraktion erfolgreich:'),
          confidence: 0.9,
        }),
      });
    });

    it('should show correct document type in progress message for email', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(mockAIResponse as never);

      const input: ExtractionInput = {
        rawText: 'Email content',
        inputType: 'email',
      };

      await runExtractionWithStreaming(input, mockEmit);

      expect(mockEmit).toHaveBeenCalledWith({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: 'Extraktion',
          message: 'Analysiere E-Mail...',
        },
      });
    });

    it('should show correct document type in progress message for freetext', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(mockAIResponse as never);

      const input: ExtractionInput = {
        rawText: 'Free text content',
        inputType: 'freetext',
      };

      await runExtractionWithStreaming(input, mockEmit);

      expect(mockEmit).toHaveBeenCalledWith({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: 'Extraktion',
          message: 'Analysiere Freitext...',
        },
      });
    });

    it('should report found items in final progress message', async () => {
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(mockAIResponse as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      const result = await runExtractionWithStreaming(input, mockEmit);

      expect(result.success).toBe(true);
      const finalCall = vi.mocked(mockEmit).mock.calls[3][0];
      expect(finalCall.data.message).toContain('Kunde');
      expect(finalCall.data.message).toContain('1 Technologien');
      expect(finalCall.data.message).toContain('1 Anforderungen');
      expect(finalCall.data.message).toContain('1 Kontakte');
    });

    it('should handle extraction errors and emit error event', async () => {
      vi.mocked(openai.chat.completions.create).mockRejectedValueOnce(new Error('Network error') as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      const result = await runExtractionWithStreaming(input, mockEmit);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');

      // Check error event emission
      expect(mockEmit).toHaveBeenCalledWith({
        type: AgentEventType.ERROR,
        data: {
          message: 'Network error',
          code: 'EXTRACTION_ERROR',
        },
      });
    });

    it('should include budget in found items when present', async () => {
      const responseWithBudget = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Test AG',
                projectDescription: 'Test',
                technologies: [],
                keyRequirements: [],
                budgetRange: {
                  min: 50000,
                  max: 100000,
                  currency: 'EUR',
                  confidence: 80,
                  rawText: '50-100k EUR',
                },
                confidenceScore: 0.8,
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithBudget as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      await runExtractionWithStreaming(input, mockEmit);

      const finalCall = vi.mocked(mockEmit).mock.calls.find(call => call[0]?.data?.message?.includes('Extraktion erfolgreich'));
      expect(finalCall).toBeDefined();
      expect(finalCall?.[0]?.data?.message).toContain('Budget');
    });

    it('should include CMS constraints in found items when present', async () => {
      const responseWithCMS = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Test AG',
                projectDescription: 'Test',
                technologies: [],
                keyRequirements: [],
                cmsConstraints: {
                  required: ['Drupal'],
                  flexibility: 'rigid',
                  confidence: 90,
                  rawText: 'Drupal required',
                },
                confidenceScore: 0.8,
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithCMS as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      await runExtractionWithStreaming(input, mockEmit);

      const finalCall = vi.mocked(mockEmit).mock.calls.find(call => call[0]?.data?.message?.includes('Extraktion erfolgreich'));
      expect(finalCall).toBeDefined();
      expect(finalCall?.[0]?.data?.message).toContain('CMS-Vorgaben');
    });

    it('should include submission deadline in found items when present', async () => {
      const responseWithDeadline = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Test AG',
                projectDescription: 'Test',
                technologies: [],
                keyRequirements: [],
                submissionDeadline: '2025-03-15',
                confidenceScore: 0.8,
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithDeadline as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      await runExtractionWithStreaming(input, mockEmit);

      const finalCall = vi.mocked(mockEmit).mock.calls.find(call => call[0]?.data?.message?.includes('Extraktion erfolgreich'));
      expect(finalCall).toBeDefined();
      expect(finalCall?.[0]?.data?.message).toContain('Abgabefrist');
    });

    it('should include deliverables in found items when present', async () => {
      const responseWithDeliverables = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Test AG',
                projectDescription: 'Test',
                technologies: [],
                keyRequirements: [],
                requiredDeliverables: [
                  {
                    name: 'Concept',
                    mandatory: true,
                    confidence: 100,
                  },
                  {
                    name: 'Proposal',
                    mandatory: true,
                    confidence: 100,
                  },
                ],
                confidenceScore: 0.8,
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithDeliverables as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      await runExtractionWithStreaming(input, mockEmit);

      const finalCall = vi.mocked(mockEmit).mock.calls.find(call => call[0]?.data?.message?.includes('Extraktion erfolgreich'));
      expect(finalCall).toBeDefined();
      expect(finalCall?.[0]?.data?.message).toContain('2 Unterlagen');
    });

    it('should include website URLs in found items when present', async () => {
      const responseWithURLs = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Test AG',
                projectDescription: 'Test',
                technologies: [],
                keyRequirements: [],
                websiteUrls: [
                  {
                    url: 'https://test.de',
                    type: 'primary',
                    extractedFromDocument: true,
                  },
                  {
                    url: 'https://product.test.de',
                    type: 'product',
                    extractedFromDocument: false,
                  },
                ],
                confidenceScore: 0.8,
                extractedAt: '2025-01-21T10:00:00.000Z',
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithURLs as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      const result = await runExtractionWithStreaming(input, mockEmit);

      expect(result.success).toBe(true);
      // Find the final progress event with the summary
      const finalCall = vi.mocked(mockEmit).mock.calls.find(call => call[0]?.data?.message?.includes('Extraktion erfolgreich'));
      expect(finalCall?.[0]?.data?.message).toContain('2 Website-URLs');
    });
  });

  describe('prompt building', () => {
    it('should include email metadata in prompt for email input type', async () => {
      const responseWithMetadata = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Test',
                projectDescription: 'Test',
                technologies: [],
                keyRequirements: [],
                confidenceScore: 0.5,
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithMetadata as never);

      const input: ExtractionInput = {
        rawText: 'Email body content',
        inputType: 'email',
        metadata: {
          from: 'sender@example.com',
          subject: 'Project Inquiry',
          date: '2025-01-15',
        },
      };

      await extractRequirements(input);

      const callArgs = vi.mocked(openai.chat.completions.create).mock.calls[0];
      const userPrompt = callArgs[0].messages[1].content;

      expect(userPrompt).toContain('EMAIL METADATA:');
      expect(userPrompt).toContain('From: sender@example.com');
      expect(userPrompt).toContain('Subject: Project Inquiry');
      expect(userPrompt).toContain('Date: 2025-01-15');
      expect(userPrompt).toContain('EMAIL CONTENT:');
    });

    it('should handle missing email metadata gracefully', async () => {
      const responseBasic = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Test',
                projectDescription: 'Test',
                technologies: [],
                keyRequirements: [],
                confidenceScore: 0.5,
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseBasic as never);

      const input: ExtractionInput = {
        rawText: 'Email without metadata',
        inputType: 'email',
        metadata: {},
      };

      await extractRequirements(input);

      const callArgs = vi.mocked(openai.chat.completions.create).mock.calls[0];
      const userPrompt = callArgs[0].messages[1].content;

      expect(userPrompt).toContain('From: Unknown');
      expect(userPrompt).toContain('Subject: Unknown');
      expect(userPrompt).toContain('Date: Unknown');
    });

    it('should include document content for PDF input type', async () => {
      const responseBasic = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Test',
                projectDescription: 'Test',
                technologies: [],
                keyRequirements: [],
                confidenceScore: 0.5,
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseBasic as never);

      const input: ExtractionInput = {
        rawText: 'PDF document content here',
        inputType: 'pdf',
      };

      await extractRequirements(input);

      const callArgs = vi.mocked(openai.chat.completions.create).mock.calls[0];
      const userPrompt = callArgs[0].messages[1].content;

      expect(userPrompt).toContain('INPUT TYPE: PDF');
      expect(userPrompt).toContain('DOCUMENT CONTENT:');
      expect(userPrompt).toContain('PDF document content here');
    });

    it('should include document content for freetext input type', async () => {
      const responseBasic = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Test',
                projectDescription: 'Test',
                technologies: [],
                keyRequirements: [],
                confidenceScore: 0.5,
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseBasic as never);

      const input: ExtractionInput = {
        rawText: 'Free text input here',
        inputType: 'freetext',
      };

      await extractRequirements(input);

      const callArgs = vi.mocked(openai.chat.completions.create).mock.calls[0];
      const userPrompt = callArgs[0].messages[1].content;

      expect(userPrompt).toContain('INPUT TYPE: FREETEXT');
      expect(userPrompt).toContain('DOCUMENT CONTENT:');
      expect(userPrompt).toContain('Free text input here');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle response with only whitespace before JSON', async () => {
      const responseWithWhitespace = {
        choices: [
          {
            message: {
              content: '   \n\n  {"customerName": "Test", "projectDescription": "Test", "technologies": [], "keyRequirements": [], "confidenceScore": 0.5, "extractedAt": "2025-01-21T10:00:00.000Z"}',
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithWhitespace as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'freetext',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      expect(result.requirements.customerName).toBe('Test');
      expect(result.error).toBeUndefined();
    });

    it('should handle response with text after JSON', async () => {
      const responseWithTrailingText = {
        choices: [
          {
            message: {
              content: '{"customerName": "Test", "projectDescription": "Test", "technologies": [], "keyRequirements": [], "confidenceScore": 0.5, "extractedAt": "2025-01-21T10:00:00.000Z"}\n\nLet me know if you need more details.',
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(responseWithTrailingText as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'freetext',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      expect(result.requirements.customerName).toBe('Test');
    });

    it('should handle complex nested JSON response', async () => {
      const complexResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Complex Customer',
                industry: 'Finance',
                companySize: 'large',
                employeeCountRange: '1000-5000',
                revenueRange: '100-500 Mio EUR',
                procurementType: 'public',
                companyLocation: 'Munich',
                industryVertical: 'Banking',
                websiteUrls: [
                  {
                    url: 'https://bank.com',
                    type: 'primary',
                    description: 'Main corporate site',
                    extractedFromDocument: true,
                  },
                ],
                projectDescription: 'Complex banking platform',
                projectName: 'Digital Bank 2025',
                technologies: ['Java', 'Spring', 'React', 'Kubernetes'],
                scope: 'Full platform migration',
                budgetRange: {
                  min: 500000,
                  max: 1000000,
                  currency: 'EUR',
                  confidence: 70,
                  rawText: 'Budget 500k-1M EUR',
                },
                timeline: '18 months',
                teamSize: 20,
                submissionDeadline: '2025-06-30',
                submissionTime: '12:00',
                projectStartDate: '2025-09-01',
                projectEndDate: '2027-02-28',
                cmsConstraints: {
                  required: ['Adobe Experience Manager'],
                  preferred: [],
                  excluded: ['WordPress'],
                  flexibility: 'rigid',
                  confidence: 95,
                  rawText: 'Must use AEM, no WordPress',
                },
                requiredDeliverables: [
                  {
                    name: 'Technical Concept',
                    description: 'Detailed technical architecture',
                    deadline: '2025-04-15',
                    deadlineTime: '12:00',
                    format: 'PDF',
                    copies: 2,
                    mandatory: true,
                    confidence: 100,
                  },
                  {
                    name: 'Project Plan',
                    description: 'MS Project plan',
                    deadline: '2025-04-15',
                    mandatory: true,
                    confidence: 95,
                  },
                ],
                contacts: [
                  {
                    name: 'Hans Meyer',
                    role: 'CTO',
                    email: 'h.meyer@bank.com',
                    phone: '+49 89 123456',
                    category: 'decision_maker',
                    confidence: 100,
                  },
                  {
                    name: 'Anna Schmidt',
                    role: 'Project Manager',
                    email: 'a.schmidt@bank.com',
                    category: 'influencer',
                    confidence: 90,
                  },
                ],
                keyRequirements: ['GDPR compliance', 'High availability 99.9%', 'PCI-DSS compliance'],
                constraints: ['On-premises deployment', 'German data center'],
                contactPerson: 'Hans Meyer',
                contactEmail: 'h.meyer@bank.com',
                contactPhone: '+49 89 123456',
                confidenceScore: 0.92,
                extractedAt: '2025-01-21T10:00:00.000Z',
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(complexResponse as never);

      const input: ExtractionInput = {
        rawText: 'Complex banking RFP',
        inputType: 'pdf',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      expect(result.requirements.customerName).toBe('Complex Customer');
      expect(result.requirements.companySize).toBe('large');
      expect(result.requirements.websiteUrls).toHaveLength(1);
      expect(result.requirements.technologies).toHaveLength(4);
      expect(result.requirements.budgetRange?.min).toBe(500000);
      expect(result.requirements.cmsConstraints?.excluded).toContain('WordPress');
      expect(result.requirements.requiredDeliverables).toHaveLength(2);
      expect(result.requirements.contacts).toHaveLength(2);
      expect(result.requirements.keyRequirements).toHaveLength(3);
      expect(result.requirements.confidenceScore).toBe(0.92);
    });

    it('should handle minimal valid response', async () => {
      const minimalResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                customerName: 'Minimal Customer',
                projectDescription: 'Simple project',
                technologies: [],
                keyRequirements: [],
                confidenceScore: 0.5,
                extractedAt: '2025-01-21T10:00:00.000Z',
              }),
            },
          },
        ],
      };
      vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(minimalResponse as never);

      const input: ExtractionInput = {
        rawText: 'Simple request',
        inputType: 'freetext',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(true);
      expect(result.requirements.customerName).toBe('Minimal Customer');
      expect(result.requirements.technologies).toHaveLength(0);
      expect(result.requirements.keyRequirements).toHaveLength(0);
    });

    it('should return empty requirements on extraction error', async () => {
      vi.mocked(openai.chat.completions.create).mockRejectedValueOnce(new Error('Service unavailable') as never);

      const input: ExtractionInput = {
        rawText: 'Test',
        inputType: 'pdf',
      };

      const result = await extractRequirements(input);

      expect(result.success).toBe(false);
      expect(result.requirements.customerName).toBe('');
      expect(result.requirements.projectDescription).toBe('');
      expect(result.requirements.technologies).toHaveLength(0);
      expect(result.requirements.keyRequirements).toHaveLength(0);
      expect(result.requirements.confidenceScore).toBe(0);
      expect(result.error).toBe('Service unavailable');
    });
  });
});
