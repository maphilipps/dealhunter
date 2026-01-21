'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterBarProps {
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}

export function FilterBar({
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  searchQuery,
  onSearchQueryChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search bids by customer or project..."
          value={searchQuery}
          onChange={e => onSearchQueryChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="extracting">Extracting</SelectItem>
            <SelectItem value="reviewing">In Review</SelectItem>
            <SelectItem value="quick_scanning">Scanning</SelectItem>
            <SelectItem value="bit_pending">Awaiting Decision</SelectItem>
            <SelectItem value="evaluating">Evaluating</SelectItem>
            <SelectItem value="decision_made">Decision Made</SelectItem>
            <SelectItem value="routed">Routed</SelectItem>
            <SelectItem value="full_scanning">Deep Analysis</SelectItem>
            <SelectItem value="bl_reviewing">BL Review</SelectItem>
            <SelectItem value="team_assigned">Team Assigned</SelectItem>
            <SelectItem value="notified">Notified</SelectItem>
            <SelectItem value="handed_off">Handed Off</SelectItem>
            <SelectItem value="archived">No Bid</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="reactive">Reactive</SelectItem>
            <SelectItem value="proactive">Proactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
