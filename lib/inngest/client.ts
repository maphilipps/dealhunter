import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'dealhunter',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
