import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  ConfidenceIndicator,
  ConfidenceBreakdown,
} from '@/components/ai-elements/confidence-indicator';

describe('ConfidenceIndicator', () => {
  describe('inline variant (default)', () => {
    it('shows percentage and High badge for confidence >= 80', () => {
      render(<ConfidenceIndicator confidence={85} />);
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('shows percentage and Medium badge for confidence >= 60 and < 80', () => {
      render(<ConfidenceIndicator confidence={65} />);
      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('shows percentage and Low badge for confidence < 60', () => {
      render(<ConfidenceIndicator confidence={45} />);
      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(<ConfidenceIndicator confidence={85} showLabel={false} />);
      expect(screen.queryByText('85%')).not.toBeInTheDocument();
      expect(screen.queryByText('High')).not.toBeInTheDocument();
    });

    it('renders progress bar with correct width', () => {
      const { container } = render(<ConfidenceIndicator confidence={75} />);
      const bar = container.querySelector('[style*="width"]');
      expect(bar).toHaveStyle({ width: '75%' });
    });

    it('applies custom className', () => {
      const { container } = render(<ConfidenceIndicator confidence={80} className="my-class" />);
      expect(container.firstChild).toHaveClass('my-class');
    });
  });

  describe('card variant', () => {
    it('renders as card with label', () => {
      render(<ConfidenceIndicator confidence={85} variant="card" label="Test Score" />);
      expect(screen.getByText('Test Score')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('shows Hoch badge for high confidence', () => {
      render(<ConfidenceIndicator confidence={85} variant="card" />);
      expect(screen.getByText('Hoch')).toBeInTheDocument();
    });

    it('shows Niedrig badge for low confidence', () => {
      render(<ConfidenceIndicator confidence={55} variant="card" />);
      expect(screen.getByText('Niedrig')).toBeInTheDocument();
    });

    it('shows Sehr niedrig badge for very low confidence', () => {
      render(<ConfidenceIndicator confidence={40} variant="card" />);
      expect(screen.getByText('Sehr niedrig')).toBeInTheDocument();
    });

    it('shows threshold warning when below threshold', () => {
      render(<ConfidenceIndicator confidence={60} variant="card" showThreshold threshold={70} />);
      expect(screen.getByText(/unter schwellenwert \(70%\)/i)).toBeInTheDocument();
    });

    it('does not show threshold warning when above threshold', () => {
      render(<ConfidenceIndicator confidence={80} variant="card" showThreshold threshold={70} />);
      expect(screen.queryByText(/unter schwellenwert/i)).not.toBeInTheDocument();
    });

    it('does not show threshold warning when showThreshold is false', () => {
      render(
        <ConfidenceIndicator confidence={60} variant="card" showThreshold={false} threshold={70} />
      );
      expect(screen.queryByText(/unter schwellenwert/i)).not.toBeInTheDocument();
    });
  });

  it('has correct displayName', () => {
    expect(ConfidenceIndicator.displayName).toBe('ConfidenceIndicator');
  });
});

describe('ConfidenceBreakdown', () => {
  const breakdown = [
    { label: 'Quality', confidence: 80 },
    { label: 'Completeness', confidence: 60, weight: 0.3 },
    { label: 'Accuracy', confidence: 90, weight: 0.5 },
  ];

  it('renders all breakdown items', () => {
    render(<ConfidenceBreakdown breakdown={breakdown} />);
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
  });

  it('displays confidence percentages', () => {
    render(<ConfidenceBreakdown breakdown={breakdown} />);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('shows weight percentage when provided', () => {
    render(<ConfidenceBreakdown breakdown={breakdown} />);
    expect(screen.getByText('(30%)')).toBeInTheDocument();
    expect(screen.getByText('(50%)')).toBeInTheDocument();
  });

  it('does not show weight when not provided', () => {
    render(<ConfidenceBreakdown breakdown={[{ label: 'Test', confidence: 70 }]} />);
    expect(screen.queryByText(/\(\d+%\)/)).not.toBeInTheDocument();
  });

  it('renders heading', () => {
    render(<ConfidenceBreakdown breakdown={breakdown} />);
    expect(screen.getByText('Confidence Breakdown')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(ConfidenceBreakdown.displayName).toBe('ConfidenceBreakdown');
  });
});
