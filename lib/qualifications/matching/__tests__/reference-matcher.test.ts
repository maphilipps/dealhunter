import { describe, expect, it } from 'vitest';

import { matchTopReferences, scoreReference } from '../reference-matcher';

describe('reference-matcher', () => {
  it('scores tech overlap and ranks matches deterministically', () => {
    const requirements = {
      requiredIndustries: ['öffentlicher sektor'],
      requiredTechnologies: ['react', 'next.js', 'barrierefreiheit'],
      teamSizeMin: 3,
      teamSizeMax: 10,
      durationMonthsMin: 3,
      durationMonthsMax: 18,
    };

    const refs = [
      {
        id: 'ref-1',
        projectName: 'Gov Portal Relaunch',
        customerName: 'Stadt X',
        industry: 'Öffentlicher Sektor',
        technologies: JSON.stringify(['React', 'Next.js', 'WCAG', 'TypeScript']),
        teamSize: 6,
        durationMonths: 9,
      },
      {
        id: 'ref-2',
        projectName: 'E-Commerce Shop',
        customerName: 'Retail Y',
        industry: 'Retail',
        technologies: JSON.stringify(['Shopware', 'PHP']),
        teamSize: 4,
        durationMonths: 6,
      },
    ];

    const top = matchTopReferences({ requirements, references: refs, topN: 2 });
    expect(top[0].referenceId).toBe('ref-1');
    expect(top[0].score).toBeGreaterThan(top[1].score);
    expect(top[0].fits.join(' ')).toMatch(/Technologie-Overlap/i);
  });

  it('surfaces gaps for industry mismatch', () => {
    const requirements = { requiredIndustries: ['gesundheitswesen'] };
    const ref = {
      id: 'ref-1',
      projectName: 'Banking App',
      customerName: 'Bank Z',
      industry: 'Finanzen',
      technologies: JSON.stringify(['React']),
      teamSize: 5,
      durationMonths: 6,
    };

    const scored = scoreReference(requirements, ref);
    expect(scored.gaps.join(' ')).toMatch(/Branche passt nicht|Branchenanforderung unklar/i);
  });
});
