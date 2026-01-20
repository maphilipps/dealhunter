export interface RedFlag {
  category: 'legal' | 'technical' | 'commercial' | 'strategic' | 'competition';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
}

export interface Competitor {
  name: string;
  strength: 'strong' | 'medium' | 'weak';
  advantages: string[];
  disadvantages?: string[];
  marketShare?: number;
}

export interface ReferenceMatch {
  projectName: string;
  customerName: string;
  year: number;
  matchScore: number;
  matchingCriteria: string[];
  technologies: string[];
  teamSize?: number;
  summary?: string;
}
