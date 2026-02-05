import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { AbortButton } from '@/components/ai-elements/abort-button';

describe('AbortButton', () => {
  it('renders button with German label', () => {
    render(<AbortButton onAbort={vi.fn()} />);
    expect(screen.getByRole('button', { name: /analyse abbrechen/i })).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<AbortButton onAbort={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: /analyse abbrechen/i })).toBeDisabled();
  });

  it('is enabled by default', () => {
    render(<AbortButton onAbort={vi.fn()} />);
    expect(screen.getByRole('button', { name: /analyse abbrechen/i })).toBeEnabled();
  });

  it('shows confirmation dialog when clicked', async () => {
    const user = userEvent.setup();
    render(<AbortButton onAbort={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /analyse abbrechen/i }));

    expect(screen.getByText('Analyse abbrechen?')).toBeInTheDocument();
    expect(screen.getByText(/dies stoppt die aktuelle auswertung/i)).toBeInTheDocument();
  });

  it('calls onAbort when confirmed', async () => {
    const user = userEvent.setup();
    const onAbort = vi.fn();
    render(<AbortButton onAbort={onAbort} />);

    await user.click(screen.getByRole('button', { name: /analyse abbrechen/i }));
    await user.click(screen.getByRole('button', { name: /ja, abbrechen/i }));

    expect(onAbort).toHaveBeenCalledOnce();
  });

  it('does not call onAbort when cancelled', async () => {
    const user = userEvent.setup();
    const onAbort = vi.fn();
    render(<AbortButton onAbort={onAbort} />);

    await user.click(screen.getByRole('button', { name: /analyse abbrechen/i }));
    await user.click(screen.getByRole('button', { name: /weiter ausführen/i }));

    expect(onAbort).not.toHaveBeenCalled();
  });

  it('has correct displayName', () => {
    expect(AbortButton.displayName).toBe('AbortButton');
  });
});
