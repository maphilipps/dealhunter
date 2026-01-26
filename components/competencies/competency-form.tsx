'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { createCompetency } from '@/lib/competencies/actions';

export function CompetencyForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<
    'technology' | 'methodology' | 'industry' | 'soft_skill'
  >('technology');
  const [level, setLevel] = useState<'basic' | 'advanced' | 'expert'>('basic');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certInput, setCertInput] = useState('');
  const [description, setDescription] = useState('');

  const handleAddCert = () => {
    if (certInput.trim() && !certifications.includes(certInput.trim())) {
      setCertifications([...certifications, certInput.trim()]);
      setCertInput('');
    }
  };

  const handleRemoveCert = (cert: string) => {
    setCertifications(certifications.filter(c => c !== cert));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await createCompetency({
        name: name.trim(),
        category,
        level,
        certifications: certifications.length > 0 ? certifications : undefined,
        description: description.trim() || undefined,
      });

      if (result.success) {
        toast.success('Kompetenz erfolgreich erstellt');
        router.push('/competencies');
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Kompetenzname *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z.B. React, Scrum, Change Management"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            required
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-2">
            Kategorie *
          </label>
          <select
            id="category"
            value={category}
            onChange={e =>
              setCategory(e.target.value as 'technology' | 'methodology' | 'industry' | 'soft_skill')
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            required
          >
            <option value="technology">Technologie</option>
            <option value="methodology">Methodik</option>
            <option value="industry">Industrie</option>
            <option value="soft_skill">Soft Skill</option>
          </select>
        </div>

        <div>
          <label htmlFor="level" className="block text-sm font-medium mb-2">
            Level *
          </label>
          <select
            id="level"
            value={level}
            onChange={e => setLevel(e.target.value as 'basic' | 'advanced' | 'expert')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            required
          >
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2">
          Beschreibung
        </label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Beschreiben Sie diese Kompetenz..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Zertifizierungen</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={certInput}
            onChange={e => setCertInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddCert())}
            placeholder="z.B. AWS Certified Developer"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={handleAddCert}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isSubmitting}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {certifications.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {certifications.map(cert => (
              <span
                key={cert}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
              >
                {cert}
                <button
                  type="button"
                  onClick={() => handleRemoveCert(cert)}
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
          disabled={isSubmitting || !name.trim()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird gespeichert...
            </>
          ) : (
            'Kompetenz speichern'
          )}
        </button>
      </div>
    </form>
  );
}
