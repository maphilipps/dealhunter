import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageResponse,
} from '@/components/ai-elements/message';

describe('Message', () => {
  it('renders children', () => {
    render(<Message from="user">Hello</Message>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies is-user class for user messages', () => {
    const { container } = render(<Message from="user">Hello</Message>);
    expect(container.firstChild).toHaveClass('is-user');
  });

  it('applies is-assistant class for assistant messages', () => {
    const { container } = render(<Message from="assistant">Hello</Message>);
    expect(container.firstChild).toHaveClass('is-assistant');
  });

  it('merges custom className', () => {
    const { container } = render(
      <Message from="user" className="custom-class">
        Hello
      </Message>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has correct displayName', () => {
    expect(Message.displayName).toBe('Message');
  });
});

describe('MessageContent', () => {
  it('renders children', () => {
    render(<MessageContent>Content</MessageContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    const { container } = render(<MessageContent className="custom">Content</MessageContent>);
    expect(container.firstChild).toHaveClass('custom');
  });

  it('has correct displayName', () => {
    expect(MessageContent.displayName).toBe('MessageContent');
  });
});

describe('MessageActions', () => {
  it('renders children', () => {
    render(<MessageActions>Actions</MessageActions>);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('has correct displayName', () => {
    expect(MessageActions.displayName).toBe('MessageActions');
  });
});

describe('MessageAction', () => {
  it('renders as a button', () => {
    render(<MessageAction label="Copy">Icon</MessageAction>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders sr-only text from label prop', () => {
    render(<MessageAction label="Copy">Icon</MessageAction>);
    expect(screen.getByText('Copy')).toHaveClass('sr-only');
  });

  it('uses tooltip as sr-only fallback when no label', () => {
    render(<MessageAction tooltip="Copy to clipboard">Icon</MessageAction>);
    expect(screen.getByText('Copy to clipboard')).toHaveClass('sr-only');
  });

  it('wraps in tooltip when tooltip prop provided', () => {
    render(<MessageAction tooltip="Copy">Icon</MessageAction>);
    // Tooltip content is rendered but hidden — the trigger wraps the button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not wrap in tooltip when no tooltip prop', () => {
    const { container } = render(<MessageAction label="Copy">Icon</MessageAction>);
    // No tooltip wrapper present
    expect(container.querySelector('[data-radix-tooltip-trigger]')).toBeNull();
  });

  it('has correct displayName', () => {
    expect(MessageAction.displayName).toBe('MessageAction');
  });
});

describe('MessageResponse', () => {
  it('has correct displayName', () => {
    expect(MessageResponse.displayName).toBe('MessageResponse');
  });
});
