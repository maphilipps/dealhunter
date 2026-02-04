'use client';

import {
  X,
  Plus,
  Globe,
  Sparkles,
  Check,
  ExternalLink,
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Loader } from '@/components/ai-elements/loader';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { suggestWebsiteUrlsAction } from '@/lib/bids/actions';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

interface ExtractionPreviewProps {
  initialData: ExtractedRequirements;
  onConfirm: (data: ExtractedRequirements) => void;
}

type WebsiteUrl = {
  url: string;
  type: 'primary' | 'product' | 'regional' | 'related' | 'corporate' | 'main' | 'other';
  description?: string | null;
  extractedFromDocument: boolean;
  selected?: boolean;
};

export function ExtractionPreview({ initialData, onConfirm }: ExtractionPreviewProps) {
  const [data, setData] = useState<ExtractedRequirements>(initialData);
  const [newTech, setNewTech] = useState('');
  const [newRequirement, setNewRequirement] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestedUrls, setSuggestedUrls] = useState<WebsiteUrl[]>([]);

  // Initialize websiteUrls from data
  const websiteUrls: WebsiteUrl[] =
    data.websiteUrls ||
    (data.websiteUrl
      ? [
          {
            url: data.websiteUrl,
            type: 'primary' as const,
            description: 'Haupt-Website',
            extractedFromDocument: true,
            selected: true,
          },
        ]
      : []);

  const handleAddTechnology = () => {
    if (newTech.trim()) {
      setData({
        ...data,
        technologies: [...data.technologies, newTech.trim()],
      });
      setNewTech('');
    }
  };

  const handleRemoveTechnology = (index: number) => {
    setData({
      ...data,
      technologies: data.technologies.filter((_, i) => i !== index),
    });
  };

  const handleAddRequirement = () => {
    if (newRequirement.trim()) {
      setData({
        ...data,
        keyRequirements: [...data.keyRequirements, newRequirement.trim()],
      });
      setNewRequirement('');
    }
  };

  const handleRemoveRequirement = (index: number) => {
    setData({
      ...data,
      keyRequirements: data.keyRequirements.filter((_, i) => i !== index),
    });
  };

  // URL management handlers
  const handleGetSuggestions = async () => {
    if (!data.customerName) {
      toast.error('Bitte zuerst Kundennamen eingeben');
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const result = await suggestWebsiteUrlsAction({
        customerName: data.customerName,
        industry: data.industry,
        projectDescription: data.projectDescription,
        technologies: data.technologies,
      });

      if (result.success && result.suggestions.length > 0) {
        setSuggestedUrls(
          result.suggestions.map(s => ({
            ...s,
            extractedFromDocument: false,
            selected: false,
          }))
        );
        toast.success(`${result.suggestions.length} URL-Vorschläge generiert`);
      } else {
        toast.info('Keine URL-Vorschläge gefunden. Bitte manuell eingeben.');
      }
    } catch {
      toast.error('Fehler beim Generieren der Vorschläge');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleToggleUrl = (index: number) => {
    const updatedUrls = [...websiteUrls];
    updatedUrls[index] = { ...updatedUrls[index], selected: !updatedUrls[index].selected };
    setData({ ...data, websiteUrls: updatedUrls });
  };

  const handleRemoveUrl = (index: number) => {
    setData({
      ...data,
      websiteUrls: websiteUrls.filter((_, i) => i !== index),
    });
  };

  const handleToggleSuggestion = (index: number) => {
    const updatedSuggestions = [...suggestedUrls];
    updatedSuggestions[index] = {
      ...updatedSuggestions[index],
      selected: !updatedSuggestions[index].selected,
    };
    setSuggestedUrls(updatedSuggestions);
  };

  const handleRemoveSuggestion = (index: number) => {
    setSuggestedUrls(suggestedUrls.filter((_, i) => i !== index));
  };

  const handleAddManualUrl = () => {
    if (newUrl.trim()) {
      let url = newUrl.trim();
      // Add https:// if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      setData({
        ...data,
        websiteUrls: [
          ...websiteUrls,
          {
            url,
            type: 'primary' as const,
            description: 'Manuell hinzugefügt',
            extractedFromDocument: false,
            selected: true,
          },
        ],
      });
      setNewUrl('');
    }
  };

  const handleConfirm = () => {
    // Merge selected suggestions into websiteUrls before confirming
    const selectedSuggestions = suggestedUrls.filter(u => u.selected);
    const allUrls = [...websiteUrls, ...selectedSuggestions];

    // Set primary URL for backwards compatibility
    const primaryUrl = allUrls.find(u => u.selected)?.url || allUrls[0]?.url;

    onConfirm({
      ...data,
      websiteUrls: allUrls,
      websiteUrl: primaryUrl,
    });
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Confidence Score */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">AI Confidence Score</p>
            <p className="text-xs text-blue-700">Vertrauensgrad der AI in die Extraktion</p>
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {Math.round(data.confidenceScore * 100)}%
          </div>
        </div>
      </div>

      {/* Customer Name */}
      <div className="space-y-2">
        <Label htmlFor="customerName">Kundenname *</Label>
        <Input
          id="customerName"
          value={data.customerName}
          onChange={e => setData({ ...data, customerName: e.target.value })}
          placeholder="Name des Kunden"
        />
      </div>

      {/* Industry */}
      {data.industry !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="industry">Branche</Label>
          <Input
            id="industry"
            value={data.industry || ''}
            onChange={e => setData({ ...data, industry: e.target.value })}
            placeholder="z.B. Automotive, Banking, Insurance"
          />
        </div>
      )}

      {/* Company Details Section */}
      <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
        <h3 className="text-sm font-semibold">Firmen-Details</h3>

        {/* Company Size */}
        <div className="space-y-2">
          <Label htmlFor="companySize">Unternehmensgröße</Label>
          <select
            id="companySize"
            value={data.companySize || ''}
            onChange={e => setData({ ...data, companySize: e.target.value as any })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">-- Bitte wählen --</option>
            <option value="startup">Startup</option>
            <option value="small">Klein (1-50 MA)</option>
            <option value="medium">Mittel (51-250 MA)</option>
            <option value="large">Groß (251-1000 MA)</option>
            <option value="enterprise">Enterprise (1000+ MA)</option>
          </select>
        </div>

        {/* Employee Count Range */}
        {data.employeeCountRange !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="employeeCountRange">Mitarbeiteranzahl</Label>
            <Input
              id="employeeCountRange"
              value={data.employeeCountRange || ''}
              onChange={e => setData({ ...data, employeeCountRange: e.target.value })}
              placeholder="z.B. 100-500 oder 1000+"
            />
          </div>
        )}

        {/* Revenue Range */}
        {data.revenueRange !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="revenueRange">Umsatzklasse</Label>
            <Input
              id="revenueRange"
              value={data.revenueRange || ''}
              onChange={e => setData({ ...data, revenueRange: e.target.value })}
              placeholder="z.B. 10-50 Mio EUR"
            />
          </div>
        )}

        {/* Procurement Type */}
        <div className="space-y-2">
          <Label htmlFor="procurementType">Beschaffungstyp</Label>
          <select
            id="procurementType"
            value={data.procurementType || ''}
            onChange={e => setData({ ...data, procurementType: e.target.value as any })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">-- Bitte wählen --</option>
            <option value="public">Öffentlich</option>
            <option value="private">Privat</option>
            <option value="semi-public">Halböffentlich</option>
          </select>
        </div>

        {/* Industry Vertical */}
        {data.industryVertical !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="industryVertical">Branchenvertikale</Label>
            <Input
              id="industryVertical"
              value={data.industryVertical || ''}
              onChange={e => setData({ ...data, industryVertical: e.target.value })}
              placeholder="Spezifischer Branchen-Sektor"
            />
          </div>
        )}

        {/* Company Location */}
        {data.companyLocation !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="companyLocation">Firmensitz</Label>
            <Input
              id="companyLocation"
              value={data.companyLocation || ''}
              onChange={e => setData({ ...data, companyLocation: e.target.value })}
              placeholder="z.B. München, Frankfurt am Main"
            />
          </div>
        )}
      </div>

      {/* Website URLs for Qualification */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Website URLs für Qualification *</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Wählen Sie die Website(s) für die technische Analyse aus
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetSuggestions}
            disabled={isLoadingSuggestions || !data.customerName}
          >
            {isLoadingSuggestions ? (
              <>
                <Loader size="sm" className="mr-2" />
                Lade Vorschläge...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                AI-Vorschläge
              </>
            )}
          </Button>
        </div>

        {/* URL List */}
        <div className="space-y-2">
          {/* Extracted URLs */}
          {websiteUrls.filter(u => u.extractedFromDocument).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Aus Dokument extrahiert:</p>
              {websiteUrls
                .filter(u => u.extractedFromDocument)
                .map((urlItem, idx) => (
                  <Card
                    key={`extracted-${idx}`}
                    className={urlItem.selected ? 'border-primary' : ''}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <a
                            href={urlItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:underline flex items-center gap-1"
                          >
                            {urlItem.url}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          {urlItem.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {urlItem.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {urlItem.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Button
                          type="button"
                          variant={urlItem.selected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleUrl(idx)}
                        >
                          {urlItem.selected ? <Check className="h-4 w-4" /> : 'Auswählen'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveUrl(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* AI Suggested URLs */}
          {suggestedUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">AI-Vorschläge:</p>
              {suggestedUrls.map((urlItem, idx) => (
                <Card
                  key={`suggested-${idx}`}
                  className={urlItem.selected ? 'border-primary' : 'border-dashed'}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Sparkles className="h-4 w-4 text-yellow-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <a
                          href={urlItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline flex items-center gap-1"
                        >
                          {urlItem.url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        {urlItem.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {urlItem.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {urlItem.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Button
                        type="button"
                        variant={urlItem.selected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleSuggestion(idx)}
                      >
                        {urlItem.selected ? <Check className="h-4 w-4" /> : 'Auswählen'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSuggestion(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No URLs warning */}
          {websiteUrls.length === 0 && suggestedUrls.length === 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                Keine Website-URLs im Dokument gefunden. Klicken Sie auf &quot;AI-Vorschläge&quot;
                oder fügen Sie manuell URLs hinzu.
              </p>
            </div>
          )}

          {/* Manual URL Entry */}
          <div className="flex gap-2 mt-3">
            <Input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddManualUrl()}
              placeholder="https://www.beispiel.de"
              type="url"
            />
            <Button type="button" onClick={handleAddManualUrl} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Project Name */}
      {data.projectName !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="projectName">Projektname</Label>
          <Input
            id="projectName"
            value={data.projectName || ''}
            onChange={e => setData({ ...data, projectName: e.target.value })}
            placeholder="Name oder Titel des Projekts"
          />
        </div>
      )}

      {/* Project Description */}
      <div className="space-y-2">
        <Label htmlFor="projectDescription">Projektbeschreibung *</Label>
        <Textarea
          id="projectDescription"
          value={data.projectDescription}
          onChange={e => setData({ ...data, projectDescription: e.target.value })}
          placeholder="Detaillierte Beschreibung der Anforderungen"
          rows={6}
        />
      </div>

      {/* Technologies */}
      <div className="space-y-2">
        <Label>Technologien *</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {data.technologies.map((tech, idx) => (
            <Badge key={idx} variant="secondary" className="pl-3 pr-1">
              {tech}
              <button
                type="button"
                onClick={() => handleRemoveTechnology(idx)}
                className="ml-2 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newTech}
            onChange={e => setNewTech(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAddTechnology()}
            placeholder="Technologie hinzufügen (Enter drücken)"
          />
          <Button type="button" onClick={handleAddTechnology} variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Requirements */}
      <div className="space-y-2">
        <Label>Hauptanforderungen *</Label>
        <div className="space-y-2 mb-2">
          {data.keyRequirements.map((req, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1 rounded-lg border bg-muted/50 p-3">
                <p className="text-sm">{req}</p>
              </div>
              <Button
                type="button"
                onClick={() => handleRemoveRequirement(idx)}
                variant="ghost"
                size="icon"
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={newRequirement}
            onChange={e => setNewRequirement(e.target.value)}
            placeholder="Neue Anforderung hinzufügen"
            rows={2}
          />
          <Button type="button" onClick={handleAddRequirement} variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Budget Range */}
      {data.budgetRange !== undefined && (
        <div className="space-y-2">
          <Label>Budgetbereich</Label>
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {data.budgetRange.min || data.budgetRange.max ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {data.budgetRange.min
                        ? new Intl.NumberFormat('de-DE').format(data.budgetRange.min)
                        : '0'}{' '}
                      -{' '}
                      {data.budgetRange.max
                        ? new Intl.NumberFormat('de-DE').format(data.budgetRange.max)
                        : '∞'}{' '}
                      {data.budgetRange.currency}
                    </span>
                    <Badge variant={data.budgetRange.confidence >= 70 ? 'default' : 'secondary'}>
                      {data.budgetRange.confidence}% sicher
                    </Badge>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Kein Budget angegeben</span>
                )}
                {data.budgetRange.rawText && (
                  <p className="text-sm text-muted-foreground">
                    Originaltext: "{data.budgetRange.rawText}"
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Timeline - Prominent Visualization */}
      {data.timeline !== undefined && (
        <TimelineCard
          timeline={data.timeline || ''}
          submissionDeadline={data.submissionDeadline}
          submissionTime={data.submissionTime}
          onChange={timeline => setData({ ...data, timeline })}
        />
      )}

      {/* Submission Deadline Visualization */}
      <SubmissionDeadlineCard data={data} onChange={updates => setData({ ...data, ...updates })} />

      {/* Required Deliverables */}
      <RequiredDeliverablesCard
        deliverables={data.requiredDeliverables || []}
        onChange={deliverables => setData({ ...data, requiredDeliverables: deliverables })}
      />

      {/* Confirm Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleConfirm} size="lg">
          Bestätigen und weiter zur Qualification
        </Button>
      </div>
    </div>
  );
}

/**
 * Submission Deadline Card with visual timeline
 */
function SubmissionDeadlineCard({
  data,
  onChange,
}: {
  data: ExtractedRequirements;
  onChange: (updates: Partial<ExtractedRequirements>) => void;
}) {
  // Calculate days until deadline
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = data.submissionDeadline ? new Date(data.submissionDeadline) : null;

  const daysUntilDeadline = deadline
    ? Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 7;
  const isExpired = daysUntilDeadline !== null && daysUntilDeadline < 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <Label className="text-base font-semibold">Fristen & Zeitrahmen</Label>
      </div>

      {/* Deadline Visualization Banner */}
      {deadline && (
        <Card
          className={`border-2 ${isExpired ? 'border-red-500 bg-red-50' : isUrgent ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50'}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isExpired ? (
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                ) : isUrgent ? (
                  <Clock className="h-8 w-8 text-orange-600" />
                ) : (
                  <Calendar className="h-8 w-8 text-blue-600" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${isExpired ? 'text-red-900' : isUrgent ? 'text-orange-900' : 'text-blue-900'}`}
                  >
                    Abgabefrist
                  </p>
                  <p
                    className={`text-2xl font-bold ${isExpired ? 'text-red-700' : isUrgent ? 'text-orange-700' : 'text-blue-700'}`}
                  >
                    {deadline.toLocaleDateString('de-DE', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    {data.submissionTime && ` um ${data.submissionTime} Uhr`}
                  </p>
                </div>
              </div>
              <div
                className={`text-right p-3 rounded-lg ${isExpired ? 'bg-red-100' : isUrgent ? 'bg-orange-100' : 'bg-blue-100'}`}
              >
                <p
                  className={`text-3xl font-bold ${isExpired ? 'text-red-700' : isUrgent ? 'text-orange-700' : 'text-blue-700'}`}
                >
                  {isExpired ? Math.abs(daysUntilDeadline) : daysUntilDeadline}
                </p>
                <p
                  className={`text-xs font-medium ${isExpired ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-blue-600'}`}
                >
                  {isExpired
                    ? 'Tage überfällig'
                    : daysUntilDeadline === 1
                      ? 'Tag verbleibend'
                      : 'Tage verbleibend'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date Inputs */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="submissionDeadline">Abgabefrist *</Label>
          <div className="flex gap-2">
            <Input
              id="submissionDeadline"
              type="date"
              value={data.submissionDeadline || ''}
              onChange={e => onChange({ submissionDeadline: e.target.value })}
              className="flex-1"
            />
            <Input
              type="time"
              value={data.submissionTime || ''}
              onChange={e => onChange({ submissionTime: e.target.value })}
              placeholder="12:00"
              className="w-24"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Heute: {today.toLocaleDateString('de-DE')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectStartDate">Projektstart (geplant)</Label>
          <Input
            id="projectStartDate"
            type="date"
            value={data.projectStartDate || ''}
            onChange={e => onChange({ projectStartDate: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectEndDate">Projektende (geplant)</Label>
          <Input
            id="projectEndDate"
            type="date"
            value={data.projectEndDate || ''}
            onChange={e => onChange({ projectEndDate: e.target.value })}
          />
        </div>
      </div>

      {/* No deadline warning */}
      {!deadline && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Keine Abgabefrist gefunden</p>
            <p className="text-xs text-yellow-700 mt-1">
              Bitte geben Sie die Abgabefrist manuell ein, um die Zeitplanung zu visualisieren.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

type Deliverable = {
  name: string;
  description?: string | null;
  deadline?: string | null;
  deadlineTime?: string | null;
  format?: string | null;
  copies?: number | null;
  mandatory: boolean;
  confidence: number;
};

/**
 * Required Deliverables Card
 */
function RequiredDeliverablesCard({
  deliverables,
  onChange,
}: {
  deliverables: Deliverable[];
  onChange: (deliverables: Deliverable[]) => void;
}) {
  const [newDeliverable, setNewDeliverable] = useState('');

  const handleAdd = () => {
    if (newDeliverable.trim()) {
      onChange([
        ...deliverables,
        {
          name: newDeliverable.trim(),
          mandatory: true,
          confidence: 100,
        },
      ]);
      setNewDeliverable('');
    }
  };

  const handleRemove = (index: number) => {
    onChange(deliverables.filter((_, i) => i !== index));
  };

  const handleToggleMandatory = (index: number) => {
    const updated = [...deliverables];
    updated[index] = { ...updated[index], mandatory: !updated[index].mandatory };
    onChange(updated);
  };

  const handleUpdateFormat = (index: number, format: string) => {
    const updated = [...deliverables];
    updated[index] = { ...updated[index], format };
    onChange(updated);
  };

  const mandatoryCount = deliverables.filter(d => d.mandatory).length;
  const optionalCount = deliverables.filter(d => !d.mandatory).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-semibold">Abzugebende Unterlagen</Label>
        </div>
        {deliverables.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="default">{mandatoryCount} Pflicht</Badge>
            {optionalCount > 0 && <Badge variant="secondary">{optionalCount} Optional</Badge>}
          </div>
        )}
      </div>

      {/* Deliverables List */}
      {deliverables.length > 0 && (
        <div className="space-y-2">
          {deliverables.map((item, idx) => (
            <Card key={idx} className={item.mandatory ? 'border-primary/50' : 'border-dashed'}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.mandatory ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      )}
                    </div>
                    <select
                      value={item.format || ''}
                      onChange={e => handleUpdateFormat(idx, e.target.value)}
                      className="text-xs border rounded px-2 py-1 bg-background"
                    >
                      <option value="">Format</option>
                      <option value="PDF">PDF</option>
                      <option value="Word">Word</option>
                      <option value="Excel">Excel</option>
                      <option value="Hardcopy">Ausdruck</option>
                      <option value="Digital">Digital</option>
                    </select>
                    <Badge
                      variant={item.mandatory ? 'default' : 'secondary'}
                      className="shrink-0 cursor-pointer"
                      onClick={() => handleToggleMandatory(idx)}
                    >
                      {item.mandatory ? 'Pflicht' : 'Optional'}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add new deliverable */}
      <div className="flex gap-2">
        <Input
          value={newDeliverable}
          onChange={e => setNewDeliverable(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="z.B. Angebotsdokument, Referenzliste, Konzeptpapier..."
        />
        <Button type="button" onClick={handleAdd} variant="outline" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Empty state */}
      {deliverables.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Keine abzugebenden Unterlagen definiert.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Fügen Sie die geforderten Dokumente hinzu (z.B. Angebot, Konzept, Referenzen).
          </p>
        </div>
      )}

      {/* Common deliverables suggestions */}
      {deliverables.length === 0 && (
        <div className="flex flex-wrap gap-2">
          <p className="text-xs text-muted-foreground w-full">Übliche Unterlagen:</p>
          {[
            'Angebotsdokument',
            'Preisblatt',
            'Konzeptpapier',
            'Referenzliste',
            'Projektplan',
            'Team-Profile',
          ].map(suggestion => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() =>
                onChange([...deliverables, { name: suggestion, mandatory: true, confidence: 80 }])
              }
            >
              <Plus className="h-3 w-3 mr-1" />
              {suggestion}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Timeline Card with phase visualization
 */
function TimelineCard({
  timeline,
  submissionDeadline,
  submissionTime,
  onChange,
}: {
  timeline: string;
  submissionDeadline?: string;
  submissionTime?: string;
  onChange: (timeline: string) => void;
}) {
  // Parse timeline text to extract phases
  const parseTimeline = (text: string) => {
    const phases: Array<{ name: string; startDate: string; endDate: string }> = [];

    // Match patterns like "Phase 1 (Build) vom 08.02.2026 bis 31.05.2026"
    const phaseRegex =
      /Phase\s+(\d+)\s*\(([^)]+)\)\s+vom\s+(\d{2}\.\d{2}\.\d{4})\s+bis\s+(\d{2}\.\d{2}\.\d{4})/gi;
    let match;

    while ((match = phaseRegex.exec(text)) !== null) {
      phases.push({
        name: `Phase ${match[1]}: ${match[2]}`,
        startDate: match[3],
        endDate: match[4],
      });
    }

    // Also match patterns like "Phase 3 (Grow) ab dem 01.08.2026"
    const openPhaseRegex = /Phase\s+(\d+)\s*\(([^)]+)\)\s+ab\s+dem\s+(\d{2}\.\d{2}\.\d{4})/gi;
    while ((match = openPhaseRegex.exec(text)) !== null) {
      phases.push({
        name: `Phase ${match[1]}: ${match[2]}`,
        startDate: match[3],
        endDate: 'Vertragsende',
      });
    }

    return phases;
  };

  const phases = parseTimeline(timeline);

  // Calculate total duration
  const calculateDuration = (startStr: string, endStr: string) => {
    if (endStr === 'Vertragsende') return null;

    const [startDay, startMonth, startYear] = startStr.split('.').map(Number);
    const [endDay, endMonth, endYear] = endStr.split('.').map(Number);

    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.round(diffDays / 30);

    return { days: diffDays, months };
  };

  // Calculate days until deadline
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = submissionDeadline ? new Date(submissionDeadline) : null;
  const daysUntilDeadline = deadline
    ? Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 7;
  const isExpired = daysUntilDeadline !== null && daysUntilDeadline < 0;

  const totalItems = (deadline ? 1 : 0) + phases.length;
  const hasContent = totalItems > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <Label className="text-base font-semibold">Projektzeitplan</Label>
      </div>

      {/* Timeline Visualization */}
      {totalItems > 0 ? (
        <Card className="border-2 border-purple-500 bg-purple-50">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <p className="font-semibold text-purple-900">
                {totalItems} {totalItems === 1 ? 'Meilenstein' : 'Meilensteine'} definiert
              </p>
            </div>

            {/* Phase Cards */}
            <div className="space-y-3">
              {/* Submission Deadline as first milestone */}
              {deadline && (
                <div
                  className={`rounded-lg border-2 p-3 space-y-2 ${
                    isExpired
                      ? 'bg-red-50 border-red-300'
                      : isUrgent
                        ? 'bg-orange-50 border-orange-300'
                        : 'bg-blue-50 border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          isExpired
                            ? 'bg-red-600 text-white'
                            : isUrgent
                              ? 'bg-orange-600 text-white'
                              : 'bg-blue-600 text-white'
                        }`}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <p
                        className={`font-semibold ${
                          isExpired
                            ? 'text-red-900'
                            : isUrgent
                              ? 'text-orange-900'
                              : 'text-blue-900'
                        }`}
                      >
                        Abgabefrist
                      </p>
                    </div>
                    {daysUntilDeadline !== null && (
                      <Badge
                        variant={isExpired ? 'destructive' : isUrgent ? 'default' : 'secondary'}
                      >
                        {isExpired
                          ? `${Math.abs(daysUntilDeadline)} Tage überfällig`
                          : `${daysUntilDeadline} Tage verbleibend`}
                      </Badge>
                    )}
                  </div>

                  {/* Deadline Date */}
                  <div className="flex items-center gap-2 text-sm pl-10">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {deadline.toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                      {submissionTime && ` um ${submissionTime} Uhr`}
                    </span>
                  </div>

                  {/* Visual indicator bar */}
                  <div className="pl-10">
                    <div
                      className={`h-2 rounded-full overflow-hidden ${
                        isExpired ? 'bg-red-100' : isUrgent ? 'bg-orange-100' : 'bg-blue-100'
                      }`}
                    >
                      <div
                        className={`h-full rounded-full ${
                          isExpired
                            ? 'bg-gradient-to-r from-red-500 to-red-600'
                            : isUrgent
                              ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                              : 'bg-gradient-to-r from-blue-500 to-blue-600'
                        }`}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Project Phases */}
              {phases.map((phase, idx) => {
                const duration = calculateDuration(phase.startDate, phase.endDate);

                return (
                  <div
                    key={idx}
                    className="bg-white rounded-lg border-2 border-purple-200 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                          {idx + 1}
                        </div>
                        <p className="font-semibold text-purple-900">{phase.name}</p>
                      </div>
                      {duration && (
                        <Badge variant="secondary">
                          {duration.months} {duration.months === 1 ? 'Monat' : 'Monate'}
                        </Badge>
                      )}
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 text-sm pl-10">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{phase.startDate}</span>
                      <span className="text-muted-foreground">bis</span>
                      <span className="font-medium">{phase.endDate}</span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="pl-10">
                      <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Original Text Preview */}
            <div className="pt-3 border-t border-purple-200">
              <p className="text-xs text-purple-700 font-medium mb-1">Originaltext:</p>
              <p className="text-xs text-purple-600 italic">{timeline}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* No phases detected - show input only */
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Keine strukturierten Phasen erkannt
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Der Zeitplan konnte nicht automatisch in Phasen unterteilt werden. Bitte überprüfen
              Sie die Eingabe.
            </p>
          </div>
        </div>
      )}

      {/* Editable Timeline Input */}
      <div className="space-y-2">
        <Label htmlFor="timeline">Zeitplan bearbeiten</Label>
        <Textarea
          id="timeline"
          value={timeline}
          onChange={e => onChange(e.target.value)}
          placeholder="z.B. Phase 1 (Build) vom 08.02.2026 bis 31.05.2026, Phase 2 (Optimize) vom 01.06.2026 bis 31.07.2026"
          rows={3}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Format: Phase X (Name) vom DD.MM.YYYY bis DD.MM.YYYY
        </p>
      </div>
    </div>
  );
}
