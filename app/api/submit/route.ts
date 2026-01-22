import { checkBotId } from 'botid/server';
import { after } from 'next/server';
import { start } from 'workflow/api';

import { formSchema } from '@/lib/types';
import { workflowInbound } from '@/workflows/inbound';

export async function POST(request: Request) {
  const verification = await checkBotId();

  if (verification.isBot) {
    return Response.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = (await request.json()) as unknown;

  const parsedBody = formSchema.safeParse(body);
  if (!parsedBody.success) {
    return Response.json({ error: parsedBody.error.message }, { status: 400 });
  }

  // Start workflow in background without blocking response
  after(async () => {
    try {
      await start(workflowInbound, [parsedBody.data]);
    } catch (error) {
      console.error('Workflow start failed:', error);
      // Error handling - workflow failed to start
    }
  });

  // Return immediately without waiting for workflow
  return Response.json({ message: 'Form submitted successfully' }, { status: 200 });
}
