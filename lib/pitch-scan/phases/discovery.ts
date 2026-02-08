import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT = `Du bist ein Website-Analyse-Experte. Analysiere die Website-URL und erkenne:
- CMS (WordPress, Drupal, Typo3, Custom, etc.)
- Framework (React, Vue, Angular, etc.)
- Backend-Technologie (PHP, Node.js, .NET, Java, etc.)
- Hosting-Provider (AWS, Azure, Hetzner, etc.)
- CDN (Cloudflare, Akamai, etc.)
- Weitere Libraries und Tools

Wichtig:
- Wenn du etwas nicht sicher ableiten kannst, setze es auf null und erklaere es kurz.
- Keine generischen Floskeln. Nenne konkrete Indikatoren (Header, URLs, Asset-Namen).

Output: JSON gemaess Schema:
- content.summary: 1-2 Saetze Gesamtueberblick
- content.findings: 3-7 konkrete Findings (problem/relevance/recommendation)
- content.techStack: strukturierte Erkennung (cms/framework/backend/hosting/cdn/libraries/...)
- confidence: 0-100
- sources: optional` as const;

export async function runDiscoveryPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-discovery',
    label: 'Discovery & Tech-Stack',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Discovery & Tech-Stack\n- Erkenne moeglichst konkret die aktuelle technische Basis.\n- Gib 3-7 Findings mit Kunden-Relevanz (aus PreQual Kontext ableiten, falls vorhanden).\n- Ziel-CMS-IDs (nur als Kontext, nicht als Voraussetzung): ${context.targetCmsIds.join(', ') || 'keine'}`,
    context,
    emit,
  });
}
