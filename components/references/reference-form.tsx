'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

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
          <button
            type="button"
            onClick={handleAddTech}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isSubmitting}
          >
            <Plus className="h-4 w-4" />
            Hinzufügen
          </button>
        </div>

        {technologies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {technologies.map(tech => (
              <span
                key={tech}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
              >
                {tech}
                <button
                  type="button"
                  onClick={() => handleRemoveTech(tech)}
                  className="hover:text-destructive"
                  disabled={isSubmitting}
                >
                  <X className="h-3 w-3" />
                </button>
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
            <select
              id="budgetRange"
              value={budgetRange}
              onChange={e => setBudgetRange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              required
            >
              <option value="">Bitte wählen...</option>
              <option value="< 50k">&lt; 50.000 €</option>
              <option value="50k - 100k">50.000 - 100.000 €</option>
              <option value="100k - 250k">100.000 - 250.000 €</option>
              <option value="250k - 500k">250.000 - 500.000 €</option>
              <option value="500k - 1M">500.000 - 1.000.000 €</option>
              <option value="> 1M">&gt; 1.000.000 €</option>
            </select>
          </div>

          <div>
            <label htmlFor="outcome" className="block text-sm font-medium mb-2">
              Ergebnis *
            </label>
            <select
              id="outcome"
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              required
            >
              <option value="">Bitte wählen...</option>
              <option value="success">Erfolgreich abgeschlossen</option>
              <option value="on_track">Im Zeitplan und im Budget</option>
              <option value="delayed">Mit Verzögerungen abgeschlossen</option>
              <option value="over_budget">Über Budget abgeschlossen</option>
            </select>
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
          <button
            type="button"
            onClick={handleAddHighlight}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isSubmitting}
          >
            <Plus className="h-4 w-4" />
            Hinzufügen
          </button>
        </div>

        {highlights.length > 0 && (
          <ul className="space-y-2">
            {highlights.map((highlight, index) => (
              <li key={index} className="flex items-start gap-2 rounded-lg bg-muted p-3">
                <span className="flex-1 text-sm">{highlight}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveHighlight(index)}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-input px-6 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          disabled={isSubmitting || technologies.length === 0}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird gespeichert...
            </>
          ) : (
            'Referenz speichern'
          )}
        </button>
      </div>
    </form>
  );
}
