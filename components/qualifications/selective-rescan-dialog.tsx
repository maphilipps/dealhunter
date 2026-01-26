/**
 * Selective Re-Scan Dialog
 *
 * Dialog for selecting which sections to re-scan.
 * Shows quality badges based on confidence scores.
 * Automatically includes dependent experts when base experts are selected.
 */

'use client';

import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeepScan, SECTION_TO_EXPERT } from '@/contexts/deep-scan-context';
import { getQualityLevel, type QualityLevel } from '@/hooks/use-background-job-status';

// ============================================================================
// Types
// ============================================================================

export interface SelectiveRescanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Section Configuration
// ============================================================================

interface SectionConfig {
  id: string;
  label: string;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  { id: 'technology', label: 'Aktuelle Technologie', description: 'Tech-Stack Analyse' },
  { id: 'website-analysis', label: 'Website-Analyse', description: 'Performance & UX' },
  { id: 'cms-architecture', label: 'Drupal-Architektur', description: 'CMS Struktur & Vergleich' },
  { id: 'hosting', label: 'Hosting & Infrastruktur', description: 'Server & Cloud' },
  { id: 'integrations', label: 'Integrationen', description: 'Drittanbieter-Systeme' },
  { id: 'migration', label: 'Migration & Projekt', description: 'Migrationsstrategie' },
  { id: 'project-org', label: 'Projekt-Organisation', description: 'Team & Timeline' },
  { id: 'costs', label: 'Kosten & Budget', description: 'Aufwandsschätzung' },
  { id: 'decision', label: 'BID/NO-BID Entscheidung', description: 'Finale Empfehlung' },
  { id: 'audit', label: 'Deep Scan Audit', description: 'Performance-Audit' },
];

// ============================================================================
// Quality Badge Styling
// ============================================================================

const QUALITY_STYLES: Record<QualityLevel, { bg: string; text: string; label: string }> = {
  excellent: { bg: 'bg-green-100', text: 'text-green-800', label: 'Exzellent' },
  good: { bg: 'bg-green-50', text: 'text-green-700', label: 'Gut' },
  acceptable: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Akzeptabel' },
  'needs-improvement': {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    label: 'Verbesserungswürdig',
  },
  low: { bg: 'bg-red-100', text: 'text-red-800', label: 'Niedrig' },
};

// ============================================================================
// Component
// ============================================================================

export function SelectiveRescanDialog({ open, onOpenChange }: SelectiveRescanDialogProps) {
  const { sectionConfidences, startSelectiveScan, isInProgress } = useDeepScan();

  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle section selection
  const toggleSection = (sectionId: string) => {
    const newSelected = new Set(selectedSections);
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId);
    } else {
      newSelected.add(sectionId);
    }
    setSelectedSections(newSelected);
  };

  // Select all sections
  const selectAll = () => {
    setSelectedSections(new Set(SECTIONS.map(s => s.id)));
  };

  // Clear all selections
  const clearAll = () => {
    setSelectedSections(new Set());
  };

  // Start the selective re-scan
  const handleStart = async () => {
    if (selectedSections.size === 0) return;

    setIsStarting(true);
    setError(null);

    try {
      const result = await startSelectiveScan(Array.from(selectedSections));
      if (result.success) {
        onOpenChange(false);
        setSelectedSections(new Set());
      } else {
        setError(result.error || 'Fehler beim Starten des Re-Scans');
      }
    } finally {
      setIsStarting(false);
    }
  };

  // Get quality badge for a section
  const getQualityBadge = (sectionId: string) => {
    const confidence = sectionConfidences[sectionId];
    if (confidence === undefined || confidence === null) {
      return (
        <Badge variant="outline" className="text-xs">
          Keine Daten
        </Badge>
      );
    }

    const level = getQualityLevel(confidence);
    const style = QUALITY_STYLES[level];

    return (
      <Badge className={`text-xs ${style.bg} ${style.text}`}>
        {style.label} ({confidence}%)
      </Badge>
    );
  };

  // Calculate which experts will actually run (including dependencies)
  const getExpertsToRun = (): string[] => {
    const experts = new Set<string>();
    for (const sectionId of selectedSections) {
      const expert = SECTION_TO_EXPERT[sectionId];
      if (expert) {
        experts.add(expert);
      }
    }
    return Array.from(experts);
  };

  const expertsToRun = getExpertsToRun();
  const hasSelections = selectedSections.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Selektiver Re-Scan
          </DialogTitle>
          <DialogDescription>
            Wählen Sie die Sektionen aus, die erneut analysiert werden sollen. Abhängige Experten
            werden automatisch mit-aktualisiert.
          </DialogDescription>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Section Selection */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedSections.size} von {SECTIONS.length} ausgewählt
            </span>
            <div className="flex gap-2">
              <Button variant="link" size="sm" onClick={selectAll} className="h-auto p-0">
                Alle auswählen
              </Button>
              <span className="text-muted-foreground">|</span>
              <Button variant="link" size="sm" onClick={clearAll} className="h-auto p-0">
                Auswahl löschen
              </Button>
            </div>
          </div>

          {/* Section List */}
          <div className="space-y-2 rounded-lg border p-4">
            {SECTIONS.map(section => (
              <label
                key={section.id}
                className="flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedSections.has(section.id)}
                    onCheckedChange={() => toggleSection(section.id)}
                    disabled={isInProgress || isStarting}
                  />
                  <div>
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  </div>
                </div>
                {getQualityBadge(section.id)}
              </label>
            ))}
          </div>

          {/* Info about dependencies */}
          {hasSelections && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{expertsToRun.length} Expert(en)</strong> werden ausgeführt:{' '}
                {expertsToRun.join(', ')}
                <br />
                <span className="text-xs text-muted-foreground">
                  Hinweis: Scraping wird nicht wiederholt - die RAG-Daten aus dem initialen Scan
                  werden verwendet.
                </span>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isStarting}>
            Abbrechen
          </Button>
          <Button
            onClick={handleStart}
            disabled={!hasSelections || isStarting || isInProgress}
            className="gap-2"
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {hasSelections ? `${selectedSections.size} Sektion(en) neu scannen` : 'Bitte auswählen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Export
// ============================================================================

export default SelectiveRescanDialog;
