import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Loader } from '@/components/ai-elements/loader';

describe('Loader', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Loader />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies animate-spin class', () => {
    const { container } = render(<Loader />);
    const svg = container.querySelector('svg');
    expect(svg?.className.baseVal || svg?.getAttribute('class')).toContain('animate-spin');
  });

  it('uses md size class by default', () => {
    const { container } = render(<Loader />);
    const svg = container.querySelector('svg');
    const classes = svg?.className.baseVal || svg?.getAttribute('class') || '';
    expect(classes).toContain('size-6');
  });

  it('renders xs size variant', () => {
    const { container } = render(<Loader size="xs" />);
    const svg = container.querySelector('svg');
    const classes = svg?.className.baseVal || svg?.getAttribute('class') || '';
    expect(classes).toContain('size-3');
  });

  it('renders sm size variant', () => {
    const { container } = render(<Loader size="sm" />);
    const svg = container.querySelector('svg');
    const classes = svg?.className.baseVal || svg?.getAttribute('class') || '';
    expect(classes).toContain('size-4');
  });

  it('renders lg size variant', () => {
    const { container } = render(<Loader size="lg" />);
    const svg = container.querySelector('svg');
    const classes = svg?.className.baseVal || svg?.getAttribute('class') || '';
    expect(classes).toContain('size-8');
  });

  it('merges custom className', () => {
    const { container } = render(<Loader className="my-custom" />);
    const svg = container.querySelector('svg');
    const classes = svg?.className.baseVal || svg?.getAttribute('class') || '';
    expect(classes).toContain('my-custom');
    expect(classes).toContain('animate-spin');
  });

  it('has correct displayName', () => {
    expect(Loader.displayName).toBe('Loader');
  });
});
