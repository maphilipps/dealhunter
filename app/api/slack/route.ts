import type { App } from '@slack/bolt';
import { createHandler } from '@vercel/slack-bolt';

import { sendEmail } from '@/lib/services';
import { getSlackApp, getReceiver, hasSlackCredentials } from '@/lib/slack';

// Check if Slack is configured (synchronous check)
const hasSlack = hasSlackCredentials;

// Lazy-loaded handler (initialized on first request)
let lazyHandler: ((request: Request) => Promise<Response>) | null = null;

function setupSlackHandlers(slackApp: App): void {
  // Set up event handlers
  slackApp.event('app_mention', async ({ event, client }) => {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: `Hello <@${event.user}>!`,
    });
  });

  slackApp.action('lead_approved', async ({ ack }) => {
    await ack();
    // in production, grab email from database or storage
    await sendEmail('Send email to the lead');
  });

  slackApp.action('lead_rejected', async ({ ack }) => {
    await ack();
    // take action for feedback from human
  });
}

async function getHandler(): Promise<((request: Request) => Promise<Response>) | null> {
  if (!hasSlack) {
    return null;
  }

  if (lazyHandler) {
    return lazyHandler;
  }

  const slackApp = await getSlackApp();
  const receiver = await getReceiver();

  if (!slackApp || !receiver) {
    return null;
  }

  setupSlackHandlers(slackApp);
  lazyHandler = createHandler(slackApp, receiver);
  return lazyHandler;
}

export async function POST(request: Request) {
  if (!hasSlack) {
    return new Response('Slack credentials not configured', {
      status: 503,
    });
  }

  const handler = await getHandler();

  if (!handler) {
    return new Response('Slack credentials not configured', {
      status: 503,
    });
  }

  return handler(request);
}
