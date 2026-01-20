import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type RfpStatus =
  | 'draft'
  | 'extracting'
  | 'reviewing'
  | 'quick_scanning'
  | 'bit_pending'
  | 'evaluating'
  | 'decision_made'
  | 'archived'
  | 'routed'
  | 'full_scanning'
  | 'bl_reviewing'
  | 'team_assigned'
  | 'notified'
  | 'handed_off'
  | 'analysis_complete'

const statusConfig: Record<RfpStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: { label: 'Draft', variant: 'outline', className: 'bg-gray-50 text-gray-700 border-gray-300' },
  extracting: { label: 'Extracting', variant: 'default', className: 'bg-blue-50 text-blue-700 border-blue-300' },
  reviewing: { label: 'In Review', variant: 'secondary', className: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
  quick_scanning: { label: 'Scanning', variant: 'default', className: 'bg-blue-50 text-blue-700 border-blue-300' },
  bit_pending: { label: 'Awaiting Decision', variant: 'secondary', className: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
  evaluating: { label: 'Evaluating', variant: 'default', className: 'bg-purple-50 text-purple-700 border-purple-300' },
  decision_made: { label: 'Decision Made', variant: 'default', className: 'bg-green-50 text-green-700 border-green-300' },
  archived: { label: 'No Bid', variant: 'destructive', className: 'bg-red-50 text-red-700 border-red-300' },
  routed: { label: 'Routed', variant: 'default', className: 'bg-indigo-50 text-indigo-700 border-indigo-300' },
  full_scanning: { label: 'Deep Analysis', variant: 'default', className: 'bg-blue-50 text-blue-700 border-blue-300' },
  bl_reviewing: { label: 'BL Review', variant: 'secondary', className: 'bg-orange-50 text-orange-700 border-orange-300' },
  team_assigned: { label: 'Team Assigned', variant: 'default', className: 'bg-green-50 text-green-700 border-green-300' },
  notified: { label: 'Notified', variant: 'default', className: 'bg-teal-50 text-teal-700 border-teal-300' },
  handed_off: { label: 'Handed Off', variant: 'default', className: 'bg-gray-50 text-gray-700 border-gray-300' },
  analysis_complete: { label: 'Analysis Complete', variant: 'default', className: 'bg-green-50 text-green-700 border-green-300' }
}

interface StatusBadgeProps {
  status: RfpStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
