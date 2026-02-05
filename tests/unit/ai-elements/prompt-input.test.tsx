import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  Input,
} from '@/components/ai-elements/prompt-input';

describe('PromptInput', () => {
  it('renders as a form element', () => {
    const { container } = render(<PromptInput onSubmit={vi.fn()}>content</PromptInput>);
    expect(container.querySelector('form')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<PromptInput onSubmit={vi.fn()}>Submit button here</PromptInput>);
    expect(screen.getByText('Submit button here')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(PromptInput.displayName).toBe('PromptInput');
  });
});

describe('PromptInputTextarea', () => {
  it('renders a textarea', () => {
    render(<PromptInputTextarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('uses default placeholder', () => {
    render(<PromptInputTextarea />);
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('accepts custom placeholder', () => {
    render(<PromptInputTextarea placeholder="Ask anything..." />);
    expect(screen.getByPlaceholderText('Ask anything...')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(PromptInputTextarea.displayName).toBe('PromptInputTextarea');
  });
});

describe('PromptInputSubmit', () => {
  it('renders a submit button', () => {
    render(<PromptInputSubmit />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('has type="submit"', () => {
    render(<PromptInputSubmit />);
    expect(screen.getByRole('button', { name: /submit/i })).toHaveAttribute('type', 'submit');
  });

  it('renders custom children instead of default icon', () => {
    render(<PromptInputSubmit>Send</PromptInputSubmit>);
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(PromptInputSubmit.displayName).toBe('PromptInputSubmit');
  });
});

describe('Input', () => {
  it('renders as a form element', () => {
    const { container } = render(<Input>content</Input>);
    expect(container.querySelector('form')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(Input.displayName).toBe('Input');
  });
});
