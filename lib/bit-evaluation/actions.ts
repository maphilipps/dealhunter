'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { bidOpportunities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { runBitEvaluation } from './agent';
import { getQuickScanResult } from '@/lib/quick-scan/actions';

/**
 * Start BIT/NO BIT evaluation
 * Triggers after Quick Scan is confirmed
 */
export async function startBitEvaluation(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid opportunity
    const [bid] = await db
      .select()
      .from(bidOpportunities)
      .where(eq(bidOpportunities.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Ensure we have extracted requirements
    if (!bid.extractedRequirements) {
      return { success: false, error: 'Keine extrahierten Anforderungen vorhanden' };
    }

    // Update status to evaluating
    await db
      .update(bidOpportunities)
      .set({ status: 'evaluating' })
      .where(eq(bidOpportunities.id, bidId));

    // Get quick scan results if available
    const quickScanResult = await getQuickScanResult(bidId);
    const quickScanData = quickScanResult.success && quickScanResult.quickScan?.status === 'completed'
      ? {
          techStack: quickScanResult.quickScan.techStack,
          contentVolume: quickScanResult.quickScan.contentVolume,
          features: quickScanResult.quickScan.features,
          blRecommendation: {
            primaryBusinessLine: quickScanResult.quickScan.recommendedBusinessLine,
            confidence: quickScanResult.quickScan.confidence,
            reasoning: quickScanResult.quickScan.reasoning,
          },
        }
      : undefined;

    // Run BIT evaluation
    const evaluationResult = await runBitEvaluation({
      bidId,
      extractedRequirements: JSON.parse(bid.extractedRequirements),
      quickScanResults: quickScanData,
    });

    // Save evaluation result and update status
    await db
      .update(bidOpportunities)
      .set({
        status: 'bit_decided',
        bitDecision: evaluationResult.decision.decision,
        bitDecisionData: JSON.stringify(evaluationResult),
        alternativeRecommendation: evaluationResult.alternative
          ? JSON.stringify(evaluationResult.alternative)
          : null,
      })
      .where(eq(bidOpportunities.id, bidId));

    return {
      success: true,
      result: evaluationResult,
    };
  } catch (error) {
    console.error('BIT evaluation error:', error);

    // Revert status on error
    await db
      .update(bidOpportunities)
      .set({ status: 'quick_scanning' })
      .where(eq(bidOpportunities.id, bidId))
      .catch(() => {}); // Ignore errors in error handler

    return { success: false, error: 'Evaluierung fehlgeschlagen' };
  }
}

/**
 * Re-trigger BIT/NO BIT evaluation
 * Sets status to 'evaluating' - the actual evaluation is executed via streaming endpoint
 */
export async function retriggerBitEvaluation(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get the bid opportunity
    const [bid] = await db
      .select()
      .from(bidOpportunities)
      .where(eq(bidOpportunities.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Ensure we have extracted requirements
    if (!bid.extractedRequirements) {
      return { success: false, error: 'Keine extrahierten Anforderungen vorhanden' };
    }

    // Reset evaluation data and set status to 'evaluating'
    // The actual evaluation will be executed via the streaming endpoint
    await db
      .update(bidOpportunities)
      .set({
        status: 'evaluating',
        bitDecision: 'pending',
        bitDecisionData: null,
        bitEvaluation: null,
        alternativeRecommendation: null,
      })
      .where(eq(bidOpportunities.id, bidId));

    return {
      success: true,
      status: 'evaluating',
    };
  } catch (error) {
    console.error('BIT evaluation re-trigger error:', error);
    return { success: false, error: 'BIT Re-Evaluierung fehlgeschlagen' };
  }
}

/**
 * Get BIT evaluation result
 */
export async function getBitEvaluationResult(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [bid] = await db
      .select()
      .from(bidOpportunities)
      .where(eq(bidOpportunities.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    if (!bid.bitDecisionData) {
      return { success: false, error: 'Keine Evaluierung vorhanden' };
    }

    const result = JSON.parse(bid.bitDecisionData);
    const alternative = bid.alternativeRecommendation
      ? JSON.parse(bid.alternativeRecommendation)
      : null;

    return {
      success: true,
      result: {
        ...result,
        alternative,
      },
      decision: bid.bitDecision,
    };
  } catch (error) {
    console.error('Get BIT result error:', error);
    return { success: false, error: 'Abrufen fehlgeschlagen' };
  }
}

/**
 * BIT-008: Confirm low confidence decision
 * User must explicitly confirm if overall confidence < 70%
 */
export async function confirmLowConfidenceDecision(
  bidId: string,
  confirm: boolean
) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [bid] = await db
      .select()
      .from(bidOpportunities)
      .where(eq(bidOpportunities.id, bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    if (bid.userId !== session.user.id) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    if (!confirm) {
      // User rejected low confidence decision
      // Revert to reviewing state for re-evaluation or manual override
      await db
        .update(bidOpportunities)
        .set({
          status: 'reviewing',
          bitDecision: 'pending',
          bitDecisionData: null,
          alternativeRecommendation: null,
        })
        .where(eq(bidOpportunities.id, bidId));

      return { success: true, confirmed: false };
    }

    // User confirmed decision despite low confidence
    // Decision is already saved, just keep status as 'bit_decided'
    return { success: true, confirmed: true };
  } catch (error) {
    console.error('Confirm decision error:', error);
    return { success: false, error: 'Bestätigung fehlgeschlagen' };
  }
}
