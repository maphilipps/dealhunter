'use client';

import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  changes: string | null;
  createdAt: Date;
  userId: string;
  userName: string | null;
  userEmail: string | null;
};

type FetchLogsResponse = {
  success: boolean;
  auditLogs: AuditLog[];
};

export function AuditTrailTable() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    entityId: '',
  });

  useEffect(() => {
    void fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.action) queryParams.set('action', filters.action);
      if (filters.entityType) queryParams.set('entityType', filters.entityType);
      if (filters.entityId) queryParams.set('entityId', filters.entityId);

      const response = await fetch(`/api/admin/audit?${queryParams}`);
      const data = (await response.json()) as FetchLogsResponse;

      if (data.success) {
        setLogs(data.auditLogs);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  function getActionBadgeVariant(action: string) {
    switch (action) {
      case 'bl_override':
      case 'bid_override':
        return 'destructive';
      case 'team_change':
      case 'status_change':
        return 'default';
      default:
        return 'secondary';
    }
  }

  function formatValue(value: string | null) {
    if (!value) return '-';
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === 'object' && parsed !== null) {
        return JSON.stringify(parsed, null, 2);
      }
      return String(parsed);
    } catch {
      return value;
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Action</label>
            <Select
              value={filters.action}
              onValueChange={value => setFilters(prev => ({ ...prev, action: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alle Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Actions</SelectItem>
                <SelectItem value="bl_override">BL Override</SelectItem>
                <SelectItem value="bid_override">Bid Override</SelectItem>
                <SelectItem value="team_change">Team Change</SelectItem>
                <SelectItem value="status_change">Status Change</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Entity Type</label>
            <Select
              value={filters.entityType}
              onValueChange={value => setFilters(prev => ({ ...prev, entityType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alle Entity Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Types</SelectItem>
                <SelectItem value="preQualification">Pre-Qualification</SelectItem>
                <SelectItem value="business_unit">Business Unit</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
                <SelectItem value="competency">Competency</SelectItem>
                <SelectItem value="competitor">Competitor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Entity ID</label>
            <Input
              placeholder="Entity ID filtern..."
              value={filters.entityId}
              onChange={e => setFilters(prev => ({ ...prev, entityId: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ action: '', entityType: '', entityId: '' })}
          >
            Filter zurücksetzen
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeitpunkt</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Vorher</TableHead>
              <TableHead>Nachher</TableHead>
              <TableHead>Begründung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Lade Audit Logs...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Keine Audit Logs gefunden
                </TableCell>
              </TableRow>
            ) : (
              logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                      locale: de,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{log.userName}</div>
                    <div className="text-sm text-muted-foreground">{log.userEmail}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>
                      {log.action.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      <div className="text-muted-foreground text-xs">{log.entityType}</div>
                      <div className="truncate max-w-[200px]">{log.entityId}</div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <pre className="text-xs truncate">{formatValue(log.previousValue)}</pre>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <pre className="text-xs truncate">{formatValue(log.newValue)}</pre>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    {log.reason ? (
                      <span className="text-sm">{log.reason}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
