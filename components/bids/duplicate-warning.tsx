'use client';

import { AlertTriangle, ExternalLink, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { DuplicateCheckResult } from '@/lib/bids/duplicate-check';

interface DuplicateWarningProps {
  duplicateCheck: DuplicateCheckResult;
  onDismiss?: () => void;
}

export function DuplicateWarning({ duplicateCheck, onDismiss }: DuplicateWarningProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || !duplicateCheck.hasDuplicates) {
    return null;
  }

  const hasExactMatches = duplicateCheck.exactMatches.length > 0;
  const hasSimilarMatches = duplicateCheck.similarMatches.length > 0;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <Alert
      variant={hasExactMatches ? 'destructive' : 'default'}
      className={
        hasExactMatches
          ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
          : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
      }
    >
      <AlertTriangle
        className={`h-4 w-4 ${hasExactMatches ? 'text-red-600' : 'text-yellow-600'}`}
      />
      <AlertTitle className="flex items-center justify-between">
        <span>{hasExactMatches ? 'Mögliche Duplikate gefunden!' : 'Ähnliche RFPs gefunden'}</span>
        <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 w-6 p-0">
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between mb-2">
            <p
              className={`text-sm ${hasExactMatches ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'}`}
            >
              {hasExactMatches
                ? `${duplicateCheck.exactMatches.length} exakte Übereinstimmung${duplicateCheck.exactMatches.length > 1 ? 'en' : ''} gefunden`
                : `${duplicateCheck.similarMatches.length} ähnliche RFP${duplicateCheck.similarMatches.length > 1 ? 's' : ''} gefunden`}
            </p>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="space-y-3 mt-3">
              {/* Exact Matches */}
              {hasExactMatches && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-red-800 dark:text-red-200">
                    Exakte Übereinstimmungen
                  </h4>
                  <ul className="space-y-2">
                    {duplicateCheck.exactMatches.map(match => (
                      <li
                        key={match.rfpId}
                        className="flex items-start justify-between p-2 rounded-md bg-red-100 dark:bg-red-900/30 text-sm"
                      >
                        <div>
                          <span className="font-medium">{match.customerName || 'Unbenannt'}</span>
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            {match.reason}
                          </p>
                          {match.submissionDeadline && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Deadline:{' '}
                              {new Date(match.submissionDeadline).toLocaleDateString('de-DE')}
                            </p>
                          )}
                        </div>
                        <a
                          href={`/bids/${match.rfpId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                        >
                          Öffnen <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Similar Matches */}
              {hasSimilarMatches && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                    Ähnliche RFPs
                  </h4>
                  <ul className="space-y-2">
                    {duplicateCheck.similarMatches.map(match => (
                      <li
                        key={match.rfpId}
                        className="flex items-start justify-between p-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-sm"
                      >
                        <div>
                          <span className="font-medium">{match.customerName || 'Unbenannt'}</span>
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
                            {match.similarity}% Ähnlichkeit
                          </span>
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                            {match.reason}
                          </p>
                          {match.submissionDeadline && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Deadline:{' '}
                              {new Date(match.submissionDeadline).toLocaleDateString('de-DE')}
                            </p>
                          )}
                        </div>
                        <a
                          href={`/bids/${match.rfpId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-yellow-600 hover:underline"
                        >
                          Öffnen <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-3">
                Bitte prüfen Sie, ob es sich um ein Duplikat handelt. Sie können trotzdem
                fortfahren.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </AlertDescription>
    </Alert>
  );
}
