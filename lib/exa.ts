import Exa from 'exa-js';

// Only instantiate Exa if API key is available
const apiKey = process.env.EXA_API_KEY;
export const exa = apiKey ? new Exa(apiKey) : null;

// Helper to check if Exa is available
export function isExaAvailable(): boolean {
  return exa !== null;
}
