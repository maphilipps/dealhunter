import { describe, expect, it } from 'vitest';

import { estimateBidDeliverablesEffort } from '../bid-deliverables-effort';

describe('bid-deliverables-effort estimator', () => {
  it('increases effort with pageLimit factor', () => {
    const base = estimateBidDeliverablesEffort([
      {
        name: 'Technisches Konzept',
        category: 'technical',
        mandatory: true,
        pageLimit: 10,
        submissionMethod: 'portal',
      },
    ]);

    const higher = estimateBidDeliverablesEffort([
      {
        name: 'Technisches Konzept',
        category: 'technical',
        mandatory: true,
        pageLimit: 30,
        submissionMethod: 'portal',
      },
    ]);

    expect(higher.totals.effortHours).toBeGreaterThan(base.totals.effortHours);
  });

  it('reduces effort for optional deliverables', () => {
    const mandatory = estimateBidDeliverablesEffort([
      {
        name: 'Commercial Sheet',
        category: 'commercial',
        mandatory: true,
        pageLimit: null,
        submissionMethod: 'email',
      },
    ]);

    const optional = estimateBidDeliverablesEffort([
      {
        name: 'Commercial Sheet',
        category: 'commercial',
        mandatory: false,
        pageLimit: null,
        submissionMethod: 'email',
      },
    ]);

    expect(optional.totals.effortHours).toBeLessThan(mandatory.totals.effortHours);
  });

  it('adds review/QA overhead', () => {
    const noOverhead = estimateBidDeliverablesEffort(
      [
        {
          name: 'Proposal Document',
          category: 'proposal_document',
          mandatory: true,
          pageLimit: 10,
          submissionMethod: 'portal',
        },
      ],
      { reviewQaOverheadPct: 0 }
    );

    const withOverhead = estimateBidDeliverablesEffort(
      [
        {
          name: 'Proposal Document',
          category: 'proposal_document',
          mandatory: true,
          pageLimit: 10,
          submissionMethod: 'portal',
        },
      ],
      { reviewQaOverheadPct: 0.25 }
    );

    expect(withOverhead.totals.effortHours).toBeGreaterThan(noOverhead.totals.effortHours);
  });
});
