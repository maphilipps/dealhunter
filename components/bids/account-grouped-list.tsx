import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronRight } from 'lucide-react';

export interface BidOpportunity {
  id: string;
  status: string;
  decision: string;
  source: string;
  accountId?: string;
  accountName?: string;
  projectName?: string;
  createdAt: Date;
  extractedRequirements?: any;
}

interface AccountGroup {
  accountId: string | null;
  accountName: string;
  opportunities: BidOpportunity[];
}

interface AccountGroupedListProps {
  opportunities: BidOpportunity[];
}

export function AccountGroupedList({ opportunities }: AccountGroupedListProps) {
  // Group opportunities by account
  const grouped = opportunities.reduce(
    (acc, opp) => {
      const customerName =
        opp.accountName ||
        (opp.extractedRequirements && JSON.parse(opp.extractedRequirements).customerName) ||
        'Unknown Customer';
      const accountId = opp.accountId || null;
      const key = accountId || customerName;

      if (!acc[key]) {
        acc[key] = {
          accountId,
          accountName: customerName,
          opportunities: [],
        };
      }

      acc[key].opportunities.push(opp);
      return acc;
    },
    {} as Record<string, AccountGroup>
  );

  const accountGroups = Object.values(grouped).sort((a, b) =>
    a.accountName.localeCompare(b.accountName)
  );

  if (accountGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Opportunities grouped by customer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No accounts yet. Upload an RFP to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>
          {accountGroups.length} {accountGroups.length === 1 ? 'customer' : 'customers'} with
          opportunities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {accountGroups.map(group => (
          <div key={group.accountId || group.accountName} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">{group.accountName}</h3>
                <Badge variant="outline" className="ml-2">
                  {group.opportunities.length}{' '}
                  {group.opportunities.length === 1 ? 'opportunity' : 'opportunities'}
                </Badge>
              </div>
              {group.accountId && (
                <Link
                  href={`/accounts/${group.accountId}`}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  View Account
                </Link>
              )}
            </div>

            <div className="space-y-2 pl-6">
              {group.opportunities.map(opp => {
                const projectName =
                  opp.projectName ||
                  (opp.extractedRequirements &&
                    JSON.parse(opp.extractedRequirements).projectDescription) ||
                  'Untitled Project';

                return (
                  <Link
                    key={opp.id}
                    href={`/rfps/${opp.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium line-clamp-1">{projectName}</p>
                        <StatusBadge status={opp.status as any} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="capitalize text-xs">
                          {opp.source}
                        </Badge>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(opp.createdAt), { addSuffix: true })}
                        </span>
                        {opp.decision !== 'pending' && (
                          <>
                            <span>•</span>
                            <span
                              className={opp.decision === 'bid' ? 'text-green-600' : 'text-red-600'}
                            >
                              {opp.decision === 'bid' ? 'Bid' : 'No Bid'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
