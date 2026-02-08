'use client';

import { memo } from 'react';
import {
  Building2,
  DollarSign,
  Calendar,
  Code,
  User,
  FileText,
  Target,
  Briefcase,
  ScrollText,
  Clock,
  Factory,
  MapPin,
  Award,
  Package,
  Scale,
  Wrench,
  Flag,
  LayoutGrid,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
} from 'lucide-react';

import { ConfidenceIndicator } from '@/components/ai-elements/confidence-indicator';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Badge } from '@/components/ui/badge';
import type { FindingType } from '@/lib/streaming/redis/qualification-events';

interface ProcessingFindingProps {
  type: FindingType;
  label: string;
  value: string;
  confidence?: number;
}

const FINDING_ICONS: Record<FindingType, React.ElementType> = {
  customer: Building2,
  budget: DollarSign,
  timeline: Calendar,
  tech_stack: Code,
  contact: User,
  decision: Target,
  requirement: FileText,
  scope: Briefcase,
  contract: ScrollText,
  deadline: Clock,
  industry: Factory,
  location: MapPin,
  reference: Award,
  deliverable: Package,
  criterion: Scale,
  service: Wrench,
  goal: Flag,
  business_line: LayoutGrid,
  cms: Code,
  question: HelpCircle,
  strength: ThumbsUp,
  weakness: ThumbsDown,
  condition: AlertTriangle,
};

const FINDING_BADGE_VARIANT: Record<
  FindingType,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  customer: 'default',
  budget: 'default',
  timeline: 'secondary',
  tech_stack: 'secondary',
  contact: 'outline',
  decision: 'destructive',
  requirement: 'outline',
  scope: 'secondary',
  contract: 'outline',
  deadline: 'destructive',
  industry: 'secondary',
  location: 'outline',
  reference: 'secondary',
  deliverable: 'outline',
  criterion: 'secondary',
  service: 'outline',
  goal: 'default',
  business_line: 'default',
  cms: 'secondary',
  question: 'outline',
  strength: 'default',
  weakness: 'destructive',
  condition: 'secondary',
};

export const ProcessingFinding = memo(function ProcessingFinding({
  type,
  label,
  value,
  confidence,
}: ProcessingFindingProps) {
  const Icon = FINDING_ICONS[type];
  const badgeVariant = FINDING_BADGE_VARIANT[type];

  return (
    <Message from="assistant">
      <MessageContent>
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={badgeVariant} className="text-xs">
                {label}
              </Badge>
              {confidence !== undefined && (
                <ConfidenceIndicator confidence={confidence} size="sm" showLabel={false} />
              )}
            </div>
            <p className="text-sm break-words">{value}</p>
          </div>
        </div>
      </MessageContent>
    </Message>
  );
});
