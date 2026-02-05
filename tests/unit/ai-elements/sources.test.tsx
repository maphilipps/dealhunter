import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

import { Sources } from '@/components/ai-elements/sources';

const mockSources = [
  { type: 'reference' as const, title: 'Project Alpha', content: 'A reference project' },
  { type: 'competitor' as const, title: 'Competitor Corp' },
  { type: 'technology' as const, title: 'React', content: 'Frontend framework' },
];

describe('Sources', () => {
  it('returns null for empty sources array', () => {
    const { container } = render(<Sources sources={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders trigger with correct source count', () => {
    render(<Sources sources={mockSources} />);
    expect(screen.getByText(/quellen \(3\)/i)).toBeInTheDocument();
  });

  it('renders single source count correctly', () => {
    render(<Sources sources={[mockSources[0]]} />);
    expect(screen.getByText(/quellen \(1\)/i)).toBeInTheDocument();
  });

  it('shows source details when expanded', async () => {
    const user = userEvent.setup();
    render(<Sources sources={mockSources} />);

    await user.click(screen.getByText(/quellen \(3\)/i));

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Competitor Corp')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders source type badges', async () => {
    const user = userEvent.setup();
    render(<Sources sources={mockSources} />);

    await user.click(screen.getByText(/quellen \(3\)/i));

    expect(screen.getByText('reference')).toBeInTheDocument();
    expect(screen.getByText('competitor')).toBeInTheDocument();
    expect(screen.getByText('technology')).toBeInTheDocument();
  });

  it('renders optional content when provided', async () => {
    const user = userEvent.setup();
    render(<Sources sources={mockSources} />);

    await user.click(screen.getByText(/quellen \(3\)/i));

    expect(screen.getByText('A reference project')).toBeInTheDocument();
    expect(screen.getByText('Frontend framework')).toBeInTheDocument();
  });

  it('does not render content paragraph when content is not provided', async () => {
    const user = userEvent.setup();
    const sourcesWithoutContent = [{ type: 'competitor' as const, title: 'Test Corp' }];
    render(<Sources sources={sourcesWithoutContent} />);

    await user.click(screen.getByText(/quellen \(1\)/i));

    expect(screen.getByText('Test Corp')).toBeInTheDocument();
    // Only the title and badge, no content paragraph
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(Sources.displayName).toBe('Sources');
  });
});
