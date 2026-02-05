'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Loader } from '@/components/ai-elements/loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createCompetitor, updateCompetitor } from '@/lib/master-data/actions';

interface CompetitorFormProps {
  initialData?: {
    id: string;
    companyName: string;
    website: string | null;
    industry: string | null;
    description: string | null;
    strengths: string | null;
    weaknesses: string | null;
    typicalMarkets: string | null;
  };
}

function TagInput({
  items,
  setItems,
  placeholder,
}: {
  items: string[];
  setItems: (items: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (input.trim() && !items.includes(input.trim())) {
      setItems([...items, input.trim()]);
      setInput('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1"
        />
        <Button type="button" onClick={handleAdd} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map(item => (
            <Badge key={item} variant="secondary" className="text-sm">
              {item}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setItems(items.filter(i => i !== item))}
                className="ml-1 h-auto p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function CompetitorForm({ initialData }: CompetitorFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState(initialData?.companyName ?? '');
  const [website, setWebsite] = useState(initialData?.website ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [industry, setIndustry] = useState<string[]>(() => {
    if (initialData?.industry) {
      try {
        return JSON.parse(initialData.industry) as string[];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [strengths, setStrengths] = useState<string[]>(() => {
    if (initialData?.strengths) {
      try {
        return JSON.parse(initialData.strengths) as string[];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [weaknesses, setWeaknesses] = useState<string[]>(() => {
    if (initialData?.weaknesses) {
      try {
        return JSON.parse(initialData.weaknesses) as string[];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [typicalMarkets, setTypicalMarkets] = useState<string[]>(() => {
    if (initialData?.typicalMarkets) {
      try {
        return JSON.parse(initialData.typicalMarkets) as string[];
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast.error('Bitte Firmennamen eingeben');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        companyName: companyName.trim(),
        website: website.trim() || undefined,
        industry: industry.length > 0 ? industry : undefined,
        description: description.trim() || undefined,
        strengths: strengths.length > 0 ? strengths : undefined,
        weaknesses: weaknesses.length > 0 ? weaknesses : undefined,
        typicalMarkets: typicalMarkets.length > 0 ? typicalMarkets : undefined,
      };

      const result = isEditing
        ? await updateCompetitor(initialData.id, payload)
        : await createCompetitor(payload);

      if (result.success) {
        toast.success(isEditing ? 'Wettbewerber aktualisiert' : 'Wettbewerber erstellt');
        router.push('/master-data/competitors');
      } else {
        toast.error(result.error || 'Fehler beim Speichern');
      }
    } catch {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Firmenname *</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="z.B. Accenture, Capgemini"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder="https://example.com"
          />
        </div>

        <div className="space-y-2">
          <Label>Industrien</Label>
          <TagInput
            items={industry}
            setItems={setIndustry}
            placeholder="Industrie hinzufügen (z.B. Banking, Healthcare)"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Beschreibung</Label>
          <Textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Kurze Beschreibung des Wettbewerbers"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Stärken</Label>
          <TagInput
            items={strengths}
            setItems={setStrengths}
            placeholder="Stärke hinzufügen (z.B. Große Kundenbasis, Global aufgestellt)"
          />
        </div>

        <div className="space-y-2">
          <Label>Schwächen</Label>
          <TagInput
            items={weaknesses}
            setItems={setWeaknesses}
            placeholder="Schwäche hinzufügen (z.B. Hohe Preise, Langsame Reaktionszeit)"
          />
        </div>

        <div className="space-y-2">
          <Label>Typische Märkte</Label>
          <TagInput
            items={typicalMarkets}
            setItems={setTypicalMarkets}
            placeholder="Markt hinzufügen (z.B. Enterprise, KMU, Öffentlicher Sektor)"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader size="sm" className="mr-2" />
              Wird gespeichert...
            </>
          ) : isEditing ? (
            'Aktualisieren'
          ) : (
            'Speichern'
          )}
        </Button>
      </div>
    </form>
  );
}
