import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import { StatusBadge } from './status-badge';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface ExtractedRequirements {
  [key: string]: unknown;
}

export interface PreQualificationItem {
  id: string;
  status: string;
  decision: string;
  source: string;
  accountName?: string;
  projectName?: string;
  createdAt: Date;
  websiteUrl?: string;
  extractedRequirements?: string | ExtractedRequirements;
}

interface PipelineOverviewProps {
  opportunities: PreQualificationItem[];
}

export function PipelineOverview({ opportunities }: PipelineOverviewProps) {
  if (opportunities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
          <CardDescription>All bid opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No bid opportunities yet. Upload an RFP to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline</CardTitle>
        <CardDescription>All bid opportunities ({opportunities.length})</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer / Project</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map(opp => {
              const extractedReqs =
                typeof opp.extractedRequirements === 'string'
                  ? (JSON.parse(opp.extractedRequirements) as ExtractedRequirements)
                  : opp.extractedRequirements;
              const customerName =
                opp.accountName ||
                (extractedReqs?.customerName as string | undefined) ||
                'Unknown Customer';
              const projectName =
                opp.projectName ||
                (extractedReqs?.projectDescription as string | undefined) ||
                'Untitled Project';

              return (
                <TableRow key={opp.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        href={`/pre-qualifications/${opp.id}`}
                        className="font-medium hover:underline"
                      >
                        {customerName}
                      </Link>
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {projectName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {opp.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={opp.status as any} />
                  </TableCell>
                  <TableCell>
                    {opp.decision === 'bid' && (
                      <Badge className="bg-green-50 text-green-700 border-green-300">Bid</Badge>
                    )}
                    {opp.decision === 'no_bid' && <Badge variant="destructive">No Bid</Badge>}
                    {opp.decision === 'pending' && <Badge variant="outline">Pending</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(opp.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/pre-qualifications/${opp.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
