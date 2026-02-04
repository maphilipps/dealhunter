'use client';

import { ChevronDown, FileText, Building2, Code } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Source {
  type: 'reference' | 'competitor' | 'technology';
  title: string;
  content?: string;
}

interface SourcesProps {
  sources: Source[];
}

/**
 * TRANS-003: Sources Component
 * Displays cited data and references from agent analysis
 * Best practice: Collapsible pattern for progressive disclosure
 */
export function Sources({ sources }: SourcesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  const getSourceIcon = (type: Source['type']) => {
    switch (type) {
      case 'reference':
        return <FileText className="h-4 w-4" />;
      case 'competitor':
        return <Building2 className="h-4 w-4" />;
      case 'technology':
        return <Code className="h-4 w-4" />;
    }
  };

  const getSourceBadgeVariant = (type: Source['type']): 'default' | 'secondary' | 'outline' => {
    switch (type) {
      case 'reference':
        return 'default';
      case 'competitor':
        return 'secondary';
      case 'technology':
        return 'outline';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        Sources ({sources.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {sources.map((source, index) => (
          <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <div className="flex-shrink-0 mt-0.5">{getSourceIcon(source.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={getSourceBadgeVariant(source.type)}>{source.type}</Badge>
                <span className="text-sm font-medium truncate">{source.title}</span>
              </div>
              {source.content && (
                <p className="text-sm text-muted-foreground line-clamp-2">{source.content}</p>
              )}
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
