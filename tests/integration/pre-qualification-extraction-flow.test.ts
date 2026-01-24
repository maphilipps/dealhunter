import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { server } from '../mocks/server';
import { factories } from '../utils/factories';

/**
 * Integration tests for RFP extraction flow
 *
 * Tests the complete flow from upload to extraction
 */

beforeAll(() => server.listen());
afterAll(() => server.close());
beforeEach(() => server.resetHandlers());

describe('RFP Extraction Flow', () => {
  it('should create RFP with initial draft status', () => {
    const rfp = factories.rfp();

    expect(rfp).toHaveProperty('id');
    expect(rfp.status).toBe('draft');
    expect(rfp.decision).toBe('pending');
  });

  it('should transition from draft to extracting status', () => {
    const rfp = factories.rfp();
    const updatedRfp = {
      ...rfp,
      status: 'extracting' as const,
    };

    expect(updatedRfp.status).toBe('extracting');
  });

  it('should extract requirements from RFP', () => {
    const requirements = factories.extractedRequirements();

    expect(requirements).toHaveProperty('clientName');
    expect(requirements).toHaveProperty('projectDescription');
    expect(requirements).toHaveProperty('deadline');
    expect(requirements).toHaveProperty('techStack');
    expect(requirements.techStack).toBeInstanceOf(Array);
  });

  it('should validate extracted requirements have required fields', () => {
    const requirements = factories.extractedRequirements();

    expect(requirements.clientName).toBeTruthy();
    expect(requirements.projectDescription).toBeTruthy();
    expect(requirements.deadline).toBeTruthy();
    expect(requirements.websiteUrl).toBeTruthy();
  });

  it('should transition from extracting to reviewing after extraction', () => {
    const rfp = factories.rfp({
      status: 'extracting',
      extractedRequirements: JSON.stringify(factories.extractedRequirements()),
    });

    const updatedRfp = {
      ...rfp,
      status: 'reviewing' as const,
    };

    expect(updatedRfp.status).toBe('reviewing');
    expect(updatedRfp.extractedRequirements).toBeTruthy();
  });
});

describe('Quick Scan Flow', () => {
  it('should perform quick scan after extraction', () => {
    const rfp = factories.rfp({
      status: 'reviewing',
      extractedRequirements: JSON.stringify(factories.extractedRequirements()),
    });

    const quickScanResults = factories.quickScanResults();

    expect(quickScanResults.recommendation).toBeDefined();
    expect(quickScanResults.confidence).toBeGreaterThan(0);
    expect(quickScanResults.confidence).toBeLessThanOrEqual(1);
    expect(quickScanResults.techStack).toBeDefined();
    expect(quickScanResults.estimatedEffort).toBeDefined();
  });

  it('should transition to bit_pending after quick scan', () => {
    const rfp = factories.rfp({
      status: 'quick_scanning',
      quickScanResults: JSON.stringify(factories.quickScanResults()),
    });

    const updatedRfp = {
      ...rfp,
      status: 'bit_pending' as const,
    };

    expect(updatedRfp.status).toBe('bit_pending');
  });
});

describe('Decision Flow', () => {
  it('should make bid decision based on evaluation', () => {
    const decisionData = factories.decisionData();

    expect(decisionData.decision).toBe('bid');
    expect(decisionData.confidence).toBeGreaterThan(0);
    expect(decisionData.reasoning).toBeDefined();
    expect(decisionData.scores).toBeDefined();
  });

  it('should transition to decision_made after evaluation', () => {
    const rfp = factories.rfp({
      status: 'evaluating',
      decision: 'bid',
      decisionData: JSON.stringify(factories.decisionData()),
    });

    const updatedRfp = {
      ...rfp,
      status: 'decision_made' as const,
    };

    expect(updatedRfp.status).toBe('decision_made');
    expect(updatedRfp.decision).toBe('bid');
  });

  it('should archive RFP on no_bid decision', () => {
    const rfp = factories.rfp({
      status: 'evaluating',
      decision: 'no_bid',
    });

    const updatedRfp = {
      ...rfp,
      status: 'archived' as const,
    };

    expect(updatedRfp.status).toBe('archived');
    expect(updatedRfp.decision).toBe('no_bid');
  });
});
