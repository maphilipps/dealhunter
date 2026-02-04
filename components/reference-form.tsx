'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createReference } from '@/lib/references-actions';

export function ReferenceForm() {
  const router = useRouter();
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [techInput, setTechInput] = useState('');
  const [highlightInput, setHighlightInput] = useState('');

  const handleSubmit = async (formData: FormData) => {
    const projectName = formData.get('projectName') as string;
    const customerName = formData.get('customerName') as string;
    const industry = formData.get('industry') as string;
    const scope = formData.get('scope') as string;
    const teamSize = parseInt(formData.get('teamSize') as string);
    const durationMonths = parseInt(formData.get('durationMonths') as string);
    const budgetRange = formData.get('budgetRange') as string;
    const outcome = formData.get('outcome') as string;

    if (
      !projectName ||
      !customerName ||
      !industry ||
      !scope ||
      !teamSize ||
      !durationMonths ||
      !budgetRange ||
      !outcome
    ) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    const result = await createReference({
      projectName,
      customerName,
      industry,
      technologies,
      scope,
      teamSize,
      durationMonths,
      budgetRange,
      outcome,
      highlights,
    });

    if (result.success) {
      toast.success('Referenz erfolgreich erstellt');
      router.push('/references');
    } else {
      toast.error(result.error || 'Fehler beim Erstellen');
    }
  };

  const addTechnology = () => {
    if (techInput.trim() && !technologies.includes(techInput.trim())) {
      setTechnologies([...technologies, techInput.trim()]);
      setTechInput('');
    }
  };

  const removeTechnology = (tech: string) => {
    setTechnologies(technologies.filter(t => t !== tech));
  };

  const addHighlight = () => {
    if (highlightInput.trim() && !highlights.includes(highlightInput.trim())) {
      setHighlights([...highlights, highlightInput.trim()]);
      setHighlightInput('');
    }
  };

  const removeHighlight = (highlight: string) => {
    setHighlights(highlights.filter(h => h !== highlight));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neue Referenz</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="projectName">Projektname *</Label>
              <Input
                id="projectName"
                name="projectName"
                required
                placeholder="z.B. Relaunch Unternehmenswebsite"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerName">Kunde *</Label>
              <Input id="customerName" name="customerName" required placeholder="z.B. adesso SE" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Branche *</Label>
              <Input id="industry" name="industry" required placeholder="z.B. automotive" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budgetRange">Budgetbereich *</Label>
              <Input id="budgetRange" name="budgetRange" required placeholder="z.B. 100k-250k" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamSize">Teamgröße *</Label>
              <Input
                id="teamSize"
                name="teamSize"
                type="number"
                required
                placeholder="z.B. 5"
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationMonths">Dauer (Monate) *</Label>
              <Input
                id="durationMonths"
                name="durationMonths"
                type="number"
                required
                placeholder="z.B. 6"
                min="1"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="outcome">Ergebnis *</Label>
              <Input
                id="outcome"
                name="outcome"
                required
                placeholder="z.B. Erfolgreich abgeschlossen"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scope">Projektumfang *</Label>
            <textarea
              id="scope"
              name="scope"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              rows={3}
              placeholder="Beschreibung des Projekts und der durchgeführten Leistungen"
            />
          </div>

          <div className="space-y-2">
            <Label>Technologien</Label>
            <div className="flex gap-2">
              <Input
                value={techInput}
                onChange={e => setTechInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addTechnology())}
                placeholder="Technologie eingeben"
              />
              <Button type="button" onClick={addTechnology} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {technologies.map(tech => (
                <Badge key={tech} variant="secondary">
                  {tech}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeTechnology(tech)}
                    className="ml-1 h-auto p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Highlights</Label>
            <div className="flex gap-2">
              <Input
                value={highlightInput}
                onChange={e => setHighlightInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addHighlight())}
                placeholder="Highlight eingeben"
              />
              <Button type="button" onClick={addHighlight} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {highlights.map(highlight => (
                <Badge key={highlight} variant="secondary">
                  {highlight}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeHighlight(highlight)}
                    className="ml-1 h-auto p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Abbrechen
            </Button>
            <Button type="submit">Speichern</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
