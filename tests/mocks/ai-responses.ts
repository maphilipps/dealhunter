/**
 * Mock AI responses for testing
 */

export const mockAIResponses = {
  extraction: {
    clientName: 'Acme Corporation',
    projectDescription: 'Website relaunch for e-commerce platform',
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    techStack: ['Next.js', 'React', 'TypeScript'],
    budget: '150000',
    websiteUrl: 'https://acme.example.com',
  },

  quickScan: {
    recommendation: 'bid',
    confidence: 0.88,
    reasoning: 'Strong technical fit with existing expertise. Reasonable timeline and budget.',
    techStack: {
      detected: ['WordPress', 'WooCommerce', 'PHP'],
      complexity: 'medium',
    },
    estimatedEffort: {
      min: 25,
      max: 35,
      unit: 'PT',
    },
    risks: ['Tight deadline may require additional resources'],
    opportunities: ['Potential for long-term partnership', 'Strategic account in target industry'],
  },

  decision: {
    decision: 'bid',
    confidence: 0.92,
    reasoning: {
      tech: 'Excellent match with our Next.js expertise',
      commercial: 'Budget aligns with scope',
      risk: 'Low technical risk, manageable timeline',
      legal: 'Standard terms, no red flags',
      team: 'Team available with right skills',
    },
    scores: {
      tech: 0.95,
      commercial: 0.88,
      risk: 0.85,
      legal: 0.9,
      team: 0.92,
    },
    recommendation: 'Proceed with bid - high win probability',
  },

  routing: {
    recommendedBusinessUnit: 'Digital Solutions',
    confidence: 0.9,
    reasoning: 'Best technical fit and available capacity',
    alternativeUnits: [{ name: 'Web Development', confidence: 0.75 }],
  },
};

export const mockStreamingResponse = {
  async *generateText(prompt: string) {
    const chunks = ['Analyzing', ' requirements', '...\n', 'Technical', ' fit:', ' Strong'];

    for (const chunk of chunks) {
      yield { text: chunk };
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  },
};
