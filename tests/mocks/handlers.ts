import { http, HttpResponse } from 'msw';
import { mockAIResponses } from './ai-responses';

/**
 * MSW handlers for mocking API endpoints
 */

export const handlers = [
  // Mock adesso AI Hub API (OpenAI-compatible)
  http.post('https://adesso-ai-hub.3asabc.de/v1/chat/completions', async () => {
    return HttpResponse.json({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify(mockAIResponses.extraction),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });
  }),

  // Mock RFP extraction endpoint
  http.post('/api/pre-qualifications/extract', async () => {
    return HttpResponse.json({
      success: true,
      data: mockAIResponses.extraction,
    });
  }),

  // Mock quick scan endpoint
  http.post('/api/pre-qualifications/:id/quick-scan', async () => {
    return HttpResponse.json({
      success: true,
      data: mockAIResponses.quickScan,
    });
  }),

  // Mock decision endpoint
  http.post('/api/pre-qualifications/:id/evaluate', async () => {
    return HttpResponse.json({
      success: true,
      data: mockAIResponses.decision,
    });
  }),

  // Mock routing endpoint
  http.post('/api/pre-qualifications/:id/route', async () => {
    return HttpResponse.json({
      success: true,
      data: mockAIResponses.routing,
    });
  }),
];
