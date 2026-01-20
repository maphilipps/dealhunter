import { http, HttpResponse } from 'msw';
import { mockAIResponses } from './ai-responses';

/**
 * MSW handlers for mocking API endpoints
 */

export const handlers = [
  // Mock OpenAI API
  http.post('https://api.openai.com/v1/chat/completions', async () => {
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
  http.post('/api/rfps/extract', async () => {
    return HttpResponse.json({
      success: true,
      data: mockAIResponses.extraction,
    });
  }),

  // Mock quick scan endpoint
  http.post('/api/rfps/:id/quick-scan', async () => {
    return HttpResponse.json({
      success: true,
      data: mockAIResponses.quickScan,
    });
  }),

  // Mock decision endpoint
  http.post('/api/rfps/:id/evaluate', async () => {
    return HttpResponse.json({
      success: true,
      data: mockAIResponses.decision,
    });
  }),

  // Mock routing endpoint
  http.post('/api/rfps/:id/route', async () => {
    return HttpResponse.json({
      success: true,
      data: mockAIResponses.routing,
    });
  }),
];
