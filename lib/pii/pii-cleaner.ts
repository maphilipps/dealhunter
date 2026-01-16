export interface PIIMatch {
  type: 'name' | 'email' | 'phone' | 'address';
  original: string;
  start: number;
  end: number;
  replacement: string;
}

// Simple regex-based PII detection for German context
export function detectPII(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];
  let position = 0;

  // Email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    matches.push({
      type: 'email',
      original: match[0],
      start: match.index,
      end: match.index + match[0].length,
      replacement: '[EMAIL ENTFERNT]',
    });
  }

  // German phone patterns (various formats)
  const phonePatterns = [
    /\b\d{3,5}[-.\s]?\d{3,8}[-.\s]?\d{3,8}\b/g, // 0123-456789, 0123 456 789
    /\b\+\d{1,4}[-.\s]?\d{3,5}[-.\s]?\d{3,8}[-.\s]?\d{3,8}\b/g, // +49 123 4567890
    /\b\(\d{4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})\b/g, // 0123-456-7890
  ];

  phonePatterns.forEach(regex => {
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      // Avoid duplicates with email-like patterns
      if (!matches.some(m => m.start === match.index && m.end === match.index + match[0].length)) {
        matches.push({
          type: 'phone',
          original: match[0],
          start: match.index,
          end: match.index + match[0].length,
          replacement: '[TELEFONNUMMER ENTFERNT]',
        });
      }
    }
  });

  // Common German name patterns (simple detection)
  // This is a basic pattern - for production, you'd use a proper name database
  const namePatterns = [
    /(?:Herr|Frau|Dr\.|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g, // Herr Müller, Dr. Schmidt
    /[A-Z][a-z]+\s+[A-Z][a-z]+/g, // Max Mustermann
  ];

  namePatterns.forEach(regex => {
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      const alreadyMatched = matches.some(m =>
        m.start <= match.index && m.end >= match.index + match[0].length
      );
      if (!alreadyMatched) {
        matches.push({
          type: 'name',
          original: match[0],
          start: match.index,
          end: match.index + match[0].length,
          replacement: '[NAME ENTFERNT]',
        });
      }
    }
  });

  // Address patterns (German street addresses)
  const addressPatterns = [
    /\b[A-Z][a-z]+straße\s+\d+[a-z]?\b/gi, // Müllerstraße 12
    /\b[A-Z][a-z]+str\.\s+\d+[a-z]?\b/gi, // Hauptstr. 12a
    /\b[A-Z][a-z]+platz\s+\d+\b/gi, // Marktplatz 5
    /\b\d{5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g, // 12345 Berlin
  ];

  addressPatterns.forEach(regex => {
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      const alreadyMatched = matches.some(m =>
        m.start <= match.index && m.end >= match.index + match[0].length
      );
      if (!alreadyMatched) {
        matches.push({
          type: 'address',
          original: match[0],
          start: match.index,
          end: match.index + match[0].length,
          replacement: '[ADRESSE ENTFERNT]',
        });
      }
    }
  });

  // Sort by position
  return matches.sort((a, b) => a.start - b.start);
}

export function cleanText(text: string, piiMatches: PIIMatch[]): string {
  let cleanedText = text;
  let offset = 0;

  piiMatches.forEach((match) => {
    const before = cleanedText.substring(0, match.start + offset);
    const after = cleanedText.substring(match.end + offset);
    cleanedText = before + match.replacement + after;
    offset += match.replacement.length - match.original.length;
  });

  return cleanedText;
}

export function generatePreview(text: string, piiMatches: PIIMatch[]): Array<{
  before: string;
  after: string;
  match: PIIMatch;
}> {
  return piiMatches.map(match => ({
    before: text.substring(match.start, match.end),
    after: match.replacement,
    match,
  }));
}
