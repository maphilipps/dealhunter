import type { App } from '@slack/bolt';
import type { VercelReceiver } from '@vercel/slack-bolt';

// Dynamic imports for Slack SDK to avoid bundling when not configured
let slackApp: App | null = null;
let receiver: VercelReceiver | null = null;
let slackInitialized = false;

export const hasSlackCredentials = process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET;

if (!hasSlackCredentials) {
  console.warn(
    '⚠️  SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET is not set. Slack integration will be disabled.'
  );
}

/**
 * Initialize Slack SDK dynamically (only when needed)
 */
async function initializeSlack(): Promise<void> {
  if (slackInitialized || !hasSlackCredentials) {
    return;
  }

  // Dynamic import to avoid bundling Slack SDK when not configured
  const { App, LogLevel } = await import('@slack/bolt');
  const { VercelReceiver } = await import('@vercel/slack-bolt');

  const logLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;

  receiver = new VercelReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    logLevel,
  });

  slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    receiver,
    deferInitialization: true,
    logLevel,
  });

  slackInitialized = true;
}

/**
 * Get Slack App instance (lazy loaded)
 */
export async function getSlackApp() {
  if (!hasSlackCredentials) {
    return null;
  }

  if (!slackInitialized) {
    await initializeSlack();
  }

  return slackApp;
}

/**
 * Get Slack Receiver instance (lazy loaded)
 */
export async function getReceiver() {
  if (!hasSlackCredentials) {
    return null;
  }

  if (!slackInitialized) {
    await initializeSlack();
  }

  return receiver;
}

/**
 * Send the research and qualification to the human for approval in slack
 */
export async function sendSlackMessageWithButtons(
  channel: string,
  text: string
): Promise<{ messageTs: string; channel: string }> {
  const app = await getSlackApp();

  if (!app) {
    throw new Error(
      'Slack app is not initialized. Please set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET environment variables.'
    );
  }

  // Ensure the app is initialized
  await app.client.auth.test();

  // Send message with blocks including action buttons
  const result = await app.client.chat.postMessage({
    channel,
    text,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '👍 Approve',
              emoji: true,
            },
            style: 'primary',
            action_id: 'lead_approved',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '👎 Reject',
              emoji: true,
            },
            style: 'danger',
            action_id: 'lead_rejected',
          },
        ],
      },
    ],
  });

  if (!result.ok || !result.ts) {
    throw new Error(`Failed to send Slack message`);
  }

  return {
    messageTs: result.ts,
    channel: result.channel!,
  };
}
