import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Shimmer } from '@/components/ai-elements/shimmer';

describe('Shimmer', () => {
  it('renders children', () => {
    render(<Shimmer>Loading...</Shimmer>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies default animation duration of 2s', () => {
    render(<Shimmer>content</Shimmer>);
    const el = screen.getByText('content');
    expect(el).toHaveStyle({ animationDuration: '2s' });
  });

  it('applies custom duration', () => {
    render(<Shimmer duration={5}>content</Shimmer>);
    const el = screen.getByText('content');
    expect(el).toHaveStyle({ animationDuration: '5s' });
  });

  it('renders as a span with animate-pulse class', () => {
    render(<Shimmer>content</Shimmer>);
    const el = screen.getByText('content');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('animate-pulse');
  });

  it('merges custom className', () => {
    render(<Shimmer className="custom-class">content</Shimmer>);
    const el = screen.getByText('content');
    expect(el.className).toContain('custom-class');
    expect(el.className).toContain('animate-pulse');
  });

  it('passes through additional HTML props', () => {
    render(<Shimmer data-testid="shimmer-test">content</Shimmer>);
    expect(screen.getByTestId('shimmer-test')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(Shimmer.displayName).toBe('Shimmer');
  });
});
