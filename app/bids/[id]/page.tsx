import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { bidOpportunities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { FileText, Calendar } from 'lucide-react';

interface BidDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BidDetailPage({ params }: BidDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [bid] = await db
    .select()
    .from(bidOpportunities)
    .where(eq(bidOpportunities.id, id))
    .limit(1);

  if (!bid) {
    redirect('/bids');
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Bid Details</h1>
        <p className="text-muted-foreground mt-2">ID: {bid.id}</p>
      </div>

      <div className="space-y-6">
        {/* Status */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{bid.status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bit Entscheidung</p>
              <p className="font-medium capitalize">{bid.bitDecision}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quelle</p>
              <p className="font-medium capitalize">{bid.source}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phase</p>
              <p className="font-medium uppercase">{bid.stage}</p>
            </div>
          </div>
        </div>

        {/* Input Details */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Input
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Input Typ</p>
              <p className="font-medium uppercase">{bid.inputType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Extrahierter Text</p>
              <div className="rounded-lg bg-muted p-4 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {bid.rawInput}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Metadaten
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Erstellt am</p>
              <p className="font-medium">
                {bid.createdAt ? new Date(bid.createdAt).toLocaleString('de-DE') : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Zuletzt aktualisiert</p>
              <p className="font-medium">
                {bid.updatedAt ? new Date(bid.updatedAt).toLocaleString('de-DE') : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
