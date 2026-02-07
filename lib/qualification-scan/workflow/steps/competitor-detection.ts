// ═══════════════════════════════════════════════════════════════════════════════
// COMPETITOR DETECTION STEP - QualificationScan 2.0 Workflow
// Detects agency fingerprints in HTML and matches against known competitors
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '../../../db';
import { competitors as competitorsTable } from '../../../db/schema';
import { wrapTool } from '../tool-wrapper';
import type { WebsiteData } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompetitorDetectionResult {
  detectedAgency: string | null;
  confidence: number;
  fingerprints: string[];
  matchedCompetitor?: { id: string; name: string };
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWN AGENCY FINGERPRINT PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

interface AgencyFingerprint {
  name: string;
  patterns: RegExp[];
}

const AGENCY_FINGERPRINTS: AgencyFingerprint[] = [
  {
    name: 'Accenture',
    patterns: [/accenture/i, /built\s+by\s+accenture/i],
  },
  {
    name: 'IBM iX',
    patterns: [/ibm\s*ix/i, /built\s+by\s+ibm/i],
  },
  {
    name: 'Sapient',
    patterns: [/sapient/i, /publicis\s*sapient/i],
  },
  {
    name: 'DEPT',
    patterns: [/dept\.agency/i, /deptagency/i, /built\s+by\s+dept/i],
  },
  {
    name: 'Valtech',
    patterns: [/valtech/i, /built\s+by\s+valtech/i],
  },
  {
    name: 'Wunderman Thompson',
    patterns: [/wunderman/i, /wunderman\s*thompson/i],
  },
  {
    name: 'SinnerSchrader',
    patterns: [/sinnerschrader/i, /sinner\s*schrader/i],
  },
  {
    name: 'Reply',
    patterns: [/reply\.de/i, /powered\s+by\s+reply/i],
  },
  {
    name: 'Aperto',
    patterns: [/aperto/i, /built\s+by\s+aperto/i],
  },
  {
    name: 'Virtual Identity',
    patterns: [/virtual\s*identity/i, /vi\.de/i],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function detectAgencyFingerprints(html: string): {
  agency: string | null;
  confidence: number;
  fingerprints: string[];
} {
  const fingerprints: string[] = [];
  let bestAgency: string | null = null;
  let bestMatchCount = 0;

  // Check meta generator tag
  const generatorMatch = html.match(
    /<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i
  );
  if (generatorMatch) {
    fingerprints.push(`meta-generator: ${generatorMatch[1]}`);
  }

  // Check HTML comments for "built by", "designed by", "developed by"
  const commentRegex = /<!--\s*(built|designed|developed|created|made)\s+by\s+([^-]+?)-->/gi;
  let commentMatch;
  while ((commentMatch = commentRegex.exec(html)) !== null) {
    fingerprints.push(`comment: ${commentMatch[0].trim()}`);
  }

  // Check footer text patterns
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
  const footerHtml = footerMatch ? footerMatch[1] : '';
  const builtByRegex = /(built|designed|developed|created|powered)\s+by\s+([\w\s&.]+)/gi;
  let builtByMatch;
  while ((builtByMatch = builtByRegex.exec(footerHtml)) !== null) {
    fingerprints.push(`footer: ${builtByMatch[0].trim()}`);
  }

  // Match against known agencies
  for (const agency of AGENCY_FINGERPRINTS) {
    let matchCount = 0;
    for (const pattern of agency.patterns) {
      if (pattern.test(html)) {
        matchCount++;
      }
    }
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestAgency = agency.name;
    }
  }

  // Calculate confidence based on match count and fingerprint evidence
  let confidence = 0;
  if (bestAgency) {
    confidence = Math.min(95, 40 + bestMatchCount * 20 + fingerprints.length * 10);
  }

  return { agency: bestAgency, confidence, fingerprints };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAG FORMAT
// ═══════════════════════════════════════════════════════════════════════════════

function formatCompetitorDetectionForRAG(result: unknown): string {
  const r = result as CompetitorDetectionResult;
  if (!r.detectedAgency) {
    return 'Keine Agentur-Fingerprints auf der Website erkannt.';
  }
  const parts = [`Erkannte Agentur: ${r.detectedAgency} (Confidence: ${r.confidence}%)`];
  if (r.matchedCompetitor) {
    parts.push(`Bekannter Wettbewerber: ${r.matchedCompetitor.name}`);
  }
  if (r.fingerprints.length > 0) {
    parts.push(`Fingerprints: ${r.fingerprints.join(', ')}`);
  }
  return parts.join('. ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPETITOR DETECTION STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const competitorDetectionStep = wrapTool<WebsiteData, CompetitorDetectionResult>(
  {
    name: 'competitorDetection',
    displayName: 'Competitor Detection',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: true,
    timeout: 30000,
    ragStorage: {
      chunkType: 'competitor_detection',
      category: 'fact',
      formatContent: formatCompetitorDetectionForRAG,
      getConfidence: result => (result as CompetitorDetectionResult).confidence,
    },
  },
  async (websiteData, _ctx) => {
    const { agency, confidence, fingerprints } = detectAgencyFingerprints(websiteData.html);

    const result: CompetitorDetectionResult = {
      detectedAgency: agency,
      confidence,
      fingerprints,
    };

    // Match against known competitors in DB
    if (agency) {
      try {
        const dbCompetitors = await db.select().from(competitorsTable);
        const match = dbCompetitors.find(
          c =>
            c.companyName.toLowerCase().includes(agency.toLowerCase()) ||
            agency.toLowerCase().includes(c.companyName.toLowerCase())
        );
        if (match) {
          result.matchedCompetitor = { id: match.id, name: match.companyName };
        }
      } catch (error) {
        console.warn('[CompetitorDetection] Error querying competitors DB:', error);
      }
    }

    return result;
  }
);
