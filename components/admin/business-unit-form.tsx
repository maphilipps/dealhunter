'use client';

import { Plus, X } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { createBusinessUnit } from '@/lib/admin/business-units-actions';

interface KeywordInputProps {
  keywords: string[];
  setKeywords: (keywords: string[]) => void;
}

function KeywordInput({ keywords, setKeywords }: KeywordInputProps) {
  const [input, setInput] = useState('');

  const handleAddKeyword = () => {
    if (input.trim() && !keywords.includes(input.trim())) {
      setKeywords([...keywords, input.trim()]);
      setInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleAddKeyword()}
          placeholder="Keyword eingeben"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <button
          type="button"
          onClick={handleAddKeyword}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Hinzufügen
        </button>
      </div>

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map(keyword => (
            <span
              key={keyword}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
            >
              {keyword}
              <button
                type="button"
                onClick={() => handleRemoveKeyword(keyword)}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BusinessUnitForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !leaderName.trim() || !leaderEmail.trim() || keywords.length === 0) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createBusinessUnit({
        name: name.trim(),
        leaderName: leaderName.trim(),
        leaderEmail: leaderEmail.trim(),
        keywords,
      });

      if (result.success) {
        toast.success('Business Unit erfolgreich erstellt');
        router.push('/admin/business-units');
        router.refresh();
      } else {
        toast.error(result.error || 'Fehler beim Erstellen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Create business unit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={e => void handleSubmit(e)} className="space-y-6 max-w-2xl">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Name des Bereichs *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="z.B. Public Sector"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="leaderName" className="block text-sm font-medium mb-2">
            Leiter Name *
          </label>
          <input
            id="leaderName"
            type="text"
            value={leaderName}
            onChange={e => setLeaderName(e.target.value)}
            placeholder="Vor- und Nachname"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div>
          <label htmlFor="leaderEmail" className="block text-sm font-medium mb-2">
            Leiter E-Mail *
          </label>
          <input
            id="leaderEmail"
            type="email"
            value={leaderEmail}
            onChange={e => setLeaderEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Keywords für NLP-Matching *</label>
        <p className="text-xs text-muted-foreground mb-2">
          Fügen Sie Keywords hinzu, die für die automatische Zuordnung von Bids verwendet werden
        </p>
        <KeywordInput keywords={keywords} setKeywords={setKeywords} />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-input px-6 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader size="sm" />
              Wird gespeichert...
            </>
          ) : (
            <>Speichern</>
          )}
        </button>
      </div>
    </form>
  );
}
