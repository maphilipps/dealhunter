'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Loader } from '@/components/ai-elements/loader';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createReference } from '@/lib/references/actions';

interface ReferenceFormProps {
  userId: string;
}

export function ReferenceForm({ userId }: ReferenceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [projectName, setProjectName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [industry, setIndustry] = useState('');
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [techInput, setTechInput] = useState('');
  const [scope, setScope] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [durationMonths, setDurationMonths] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [outcome, setOutcome] = useState('');
  const [highlights, setHighlights] = useState<string[]>([]);
  const [highlightInput, setHighlightInput] = useState('');

  const handleAddTech = () => {
    if (techInput.trim() && !technologies.includes(techInput.trim())) {
      setTechnologies([...technologies, techInput.trim()]);
      setTechInput('');
    }
  };

  const handleRemoveTech = (tech: string) => {
    setTechnologies(technologies.filter(t => t !== tech));
  };

  const handleAddHighlight = () => {
    if (highlightInput.trim()) {
      setHighlights([...highlights, highlightInput.trim()]);
      setHighlightInput('');
    }
  };

  const handleRemoveHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await createReference({
        projectName: projectName.trim(),
        customerName: customerName.trim(),
        industry: industry.trim(),
        technologies,
        scope: scope.trim(),
        teamSize: parseInt(teamSize),
        durationMonths: parseInt(durationMonths),
        budgetRange: budgetRange.trim(),
        outcome: outcome.trim(),
        highlights: highlights.length > 0 ? highlights : undefined,
      });

      if (result.success) {
        toast.success('Referenz erfolgreich erstellt');
        router.push('/references');
      } else {
        toast.error(result.error || 'Erstellen fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Project Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Projektdetails</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium mb-2">
              Projektname *
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="z.B. CRM-System Modernisierung"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label htmlFor="customerName" className="block text-sm font-medium mb-2">
              Kunde *
            </label>
            <input
              id="customerName"
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="z.B. ABC Manufacturing GmbH"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="industry" className="block text-sm font-medium mb-2">
            Branche *
          </label>
          <input
            id="industry"
            type="text"
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            placeholder="z.B. Automotive, Finance, Healthcare"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            required
          />
        </div>
      </div>

      {/* Technologies */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Technologien *</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={techInput}
            onChange={e => setTechInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTech())}
            placeholder="z.B. React, Node.js, PostgreSQL"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          />
          <Button type="button" onClick={handleAddTech} disabled={isSubmitting}>
            <Plus className="h-4 w-4" />
            Hinzufügen
          </Button>
        </div>

        {technologies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {technologies.map(tech => (
              <span
                key={tech}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
              >
                {tech}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveTech(tech)}
                  className="h-4 w-4 p-0 hover:text-destructive"
                  disabled={isSubmitting}
                >
                  <X className="h-3 w-3" />
                </Button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Scope & Team */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Umfang & Team</h3>

        <div>
          <label htmlFor="scope" className="block text-sm font-medium mb-2">
            Projektumfang *
          </label>
          <textarea
            id="scope"
            value={scope}
            onChange={e => setScope(e.target.value)}
            placeholder="Beschreiben Sie den Projektumfang und die deliverables..."
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="teamSize" className="block text-sm font-medium mb-2">
              Teamgröße *
            </label>
            <input
              id="teamSize"
              type="number"
              min="1"
              value={teamSize}
              onChange={e => setTeamSize(e.target.value)}
              placeholder="z.B. 5"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label htmlFor="durationMonths" className="block text-sm font-medium mb-2">
              Dauer (Monate) *
            </label>
            <input
              id="durationMonths"
              type="number"
              min="1"
              value={durationMonths}
              onChange={e => setDurationMonths(e.target.value)}
              placeholder="z.B. 12"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              required
            />
          </div>
        </div>
      </div>

      {/* Budget & Outcome */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Budget & Ergebnis</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="budgetRange" className="block text-sm font-medium mb-2">
              Budget-Bereich *
            </label>
            <Select
              value={budgetRange}
              onValueChange={setBudgetRange}
              disabled={isSubmitting}
              required
            >
              <SelectTrigger id="budgetRange" className="w-full">
                <SelectValue placeholder="Bitte wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="< 50k">&lt; 50.000 €</SelectItem>
                <SelectItem value="50k - 100k">50.000 - 100.000 €</SelectItem>
                <SelectItem value="100k - 250k">100.000 - 250.000 €</SelectItem>
                <SelectItem value="250k - 500k">250.000 - 500.000 €</SelectItem>
                <SelectItem value="500k - 1M">500.000 - 1.000.000 €</SelectItem>
                <SelectItem value="> 1M">&gt; 1.000.000 €</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="outcome" className="block text-sm font-medium mb-2">
              Ergebnis *
            </label>
            <Select value={outcome} onValueChange={setOutcome} disabled={isSubmitting} required>
              <SelectTrigger id="outcome" className="w-full">
                <SelectValue placeholder="Bitte wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Erfolgreich abgeschlossen</SelectItem>
                <SelectItem value="on_track">Im Zeitplan und im Budget</SelectItem>
                <SelectItem value="delayed">Mit Verzögerungen abgeschlossen</SelectItem>
                <SelectItem value="over_budget">Über Budget abgeschlossen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Highlights</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={highlightInput}
            onChange={e => setHighlightInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddHighlight())}
            placeholder="z.B. 40% Kosteneinsparung durch Optimierung"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          />
          <Button type="button" onClick={handleAddHighlight} disabled={isSubmitting}>
            <Plus className="h-4 w-4" />
            Hinzufügen
          </Button>
        </div>

        {highlights.length > 0 && (
          <ul className="space-y-2">
            {highlights.map((highlight, index) => (
              <li key={index} className="flex items-start gap-2 rounded-lg bg-muted p-3">
                <span className="flex-1 text-sm">{highlight}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveHighlight(index)}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Abbrechen
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || technologies.length === 0}>
          {isSubmitting ? (
            <>
              <Loader size="sm" />
              Wird gespeichert...
            </>
          ) : (
            'Referenz speichern'
          )}
        </Button>
      </div>
    </form>
  );
}
