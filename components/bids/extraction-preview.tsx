'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

interface ExtractionPreviewProps {
  initialData: ExtractedRequirements;
  onConfirm: (data: ExtractedRequirements) => void;
}

export function ExtractionPreview({ initialData, onConfirm }: ExtractionPreviewProps) {
  const [data, setData] = useState<ExtractedRequirements>(initialData);
  const [newTech, setNewTech] = useState('');
  const [newRequirement, setNewRequirement] = useState('');

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

  const handleConfirm = () => {
    onConfirm(data);
  };

  return (
    <div className="space-y-6">
      {/* Confidence Score */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">AI Confidence Score</p>
            <p className="text-xs text-blue-700">
              Vertrauensgrad der AI in die Extraktion
            </p>
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
          onChange={(e) => setData({ ...data, customerName: e.target.value })}
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
            onChange={(e) => setData({ ...data, industry: e.target.value })}
            placeholder="z.B. Automotive, Banking, Insurance"
          />
        </div>
      )}

      {/* Website URL */}
      {data.websiteUrl !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Kunden-Website *</Label>
          <Input
            id="websiteUrl"
            type="url"
            value={data.websiteUrl || ''}
            onChange={(e) => setData({ ...data, websiteUrl: e.target.value })}
            placeholder="https://www.beispiel.de"
          />
          <p className="text-xs text-muted-foreground">
            Wird für den Quick Scan benötigt (Tech-Stack-Analyse)
          </p>
        </div>
      )}

      {/* Project Name */}
      {data.projectName !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="projectName">Projektname</Label>
          <Input
            id="projectName"
            value={data.projectName || ''}
            onChange={(e) => setData({ ...data, projectName: e.target.value })}
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
          onChange={(e) => setData({ ...data, projectDescription: e.target.value })}
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
            onChange={(e) => setNewTech(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTechnology()}
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
            onChange={(e) => setNewRequirement(e.target.value)}
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
          <Label htmlFor="budgetRange">Budgetbereich</Label>
          <Input
            id="budgetRange"
            value={data.budgetRange || ''}
            onChange={(e) => setData({ ...data, budgetRange: e.target.value })}
            placeholder="z.B. 100.000 - 500.000 EUR"
          />
        </div>
      )}

      {/* Timeline */}
      {data.timeline !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="timeline">Zeitrahmen</Label>
          <Input
            id="timeline"
            value={data.timeline || ''}
            onChange={(e) => setData({ ...data, timeline: e.target.value })}
            placeholder="z.B. 6 Monate, Q1 2026"
          />
        </div>
      )}

      {/* Confirm Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleConfirm} size="lg">
          Bestätigen und weiter zum Quick Scan
        </Button>
      </div>
    </div>
  );
}
