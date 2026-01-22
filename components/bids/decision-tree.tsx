'use client';

import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { DecisionNode } from '@/lib/bit-evaluation/schema';
import { cn } from '@/lib/utils';

interface DecisionTreeProps {
  tree: DecisionNode;
  className?: string;
}

export function DecisionTree({ tree, className }: DecisionTreeProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Entscheidungsbaum</CardTitle>
      </CardHeader>
      <CardContent>
        <TreeNode node={tree} level={0} />
      </CardContent>
    </Card>
  );
}

interface TreeNodeProps {
  node: DecisionNode;
  level: number;
}

function TreeNode({ node, level }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = node.children && node.children.length > 0;

  const sentimentColor = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-yellow-600 dark:text-yellow-400',
    critical: 'text-red-700 dark:text-red-300',
  }[node.sentiment || 'neutral'];

  const sentimentBg = {
    positive: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
    negative: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
    neutral: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
    critical: 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700',
  }[node.sentiment || 'neutral'];

  const getIcon = () => {
    switch (node.type) {
      case 'decision':
        return <CheckCircle2 className="h-5 w-5" />;
      case 'blocker':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'criterion':
        return <Info className="h-5 w-5" />;
      case 'outcome':
        return <CheckCircle2 className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getBadgeVariant = () => {
    if (node.type === 'blocker') return 'destructive';
    if (node.sentiment === 'positive') return 'default';
    if (node.sentiment === 'negative') return 'destructive';
    return 'secondary';
  };

  if (!hasChildren) {
    // Leaf node - simple display
    return (
      <div
        className={cn('flex items-start gap-3 p-3 rounded-lg border', sentimentBg, 'mb-2')}
        style={{ marginLeft: `${level * 24}px` }}
      >
        <div className={cn('mt-0.5', sentimentColor)}>{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{node.label}</span>
            {node.score !== undefined && (
              <Badge variant={getBadgeVariant()} className="text-xs">
                {node.score}%
              </Badge>
            )}
            {node.weight !== undefined && (
              <span className="text-xs text-muted-foreground">
                Gewichtung: {(node.weight * 100).toFixed(0)}%
              </span>
            )}
          </div>
          {node.value && typeof node.value === 'string' && (
            <p className="text-sm text-muted-foreground mt-1">{node.value}</p>
          )}
          {node.reasoning && (
            <p className="text-sm text-muted-foreground mt-1 italic">{node.reasoning}</p>
          )}
        </div>
      </div>
    );
  }

  // Parent node - collapsible
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-2"
      style={{ marginLeft: `${level * 24}px` }}
    >
      <div className={cn('rounded-lg border', sentimentBg)}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors">
            <div className="mt-0.5">
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className={cn('mt-0.5', sentimentColor)}>{getIcon()}</div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{node.label}</span>
                {node.score !== undefined && (
                  <Badge variant={getBadgeVariant()} className="text-xs">
                    {node.score}%
                  </Badge>
                )}
                {node.weight !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    Gewichtung: {(node.weight * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {node.value && typeof node.value === 'string' && (
                <p className="text-sm text-muted-foreground mt-1">{node.value}</p>
              )}
              {node.score !== undefined && node.type === 'criterion' && (
                <Progress value={node.score} className="h-2 mt-2" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pl-3 pt-2 pb-3 space-y-2">
            {node.reasoning && (
              <p className="text-sm text-muted-foreground italic px-3">{node.reasoning}</p>
            )}
            {node.children?.map((child, index) => (
              <TreeNode key={child.id || index} node={child} level={0} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
