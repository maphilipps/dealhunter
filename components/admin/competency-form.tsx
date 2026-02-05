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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createCompetency, updateCompetency } from '@/lib/master-data/actions';

interface CompetencyFormProps {
  initialData?: {
    id: string;
    name: string;
    category: 'technology' | 'methodology' | 'industry' | 'soft_skill';
    level: 'basic' | 'advanced' | 'expert';
    description: string | null;
    certifications: string | null;
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

export function CompetencyForm({ initialData }: CompetencyFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(initialData?.name ?? '');
  const [category, setCategory] = useState<string>(initialData?.category ?? '');
  const [level, setLevel] = useState<string>(initialData?.level ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [certifications, setCertifications] = useState<string[]>(() => {
    if (initialData?.certifications) {
      try {
        return JSON.parse(initialData.certifications) as string[];
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !category || !level) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        category: category as 'technology' | 'methodology' | 'industry' | 'soft_skill',
        level: level as 'basic' | 'advanced' | 'expert',
        description: description.trim() || undefined,
        certifications: certifications.length > 0 ? certifications : undefined,
      };

      const result = isEditing
        ? await updateCompetency(initialData.id, payload)
        : await createCompetency(payload);

      if (result.success) {
        toast.success(isEditing ? 'Kompetenz aktualisiert' : 'Kompetenz erstellt');
        router.push('/master-data/competencies');
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
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z.B. React, Scrum, Finanzbranche"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Kategorie *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category" className="w-full">
              <SelectValue placeholder="Kategorie auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="technology">Technologie</SelectItem>
              <SelectItem value="methodology">Methodik</SelectItem>
              <SelectItem value="industry">Industrie</SelectItem>
              <SelectItem value="soft_skill">Soft Skill</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="level">Level *</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger id="level" className="w-full">
              <SelectValue placeholder="Level auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basis</SelectItem>
              <SelectItem value="advanced">Fortgeschritten</SelectItem>
              <SelectItem value="expert">Experte</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Beschreibung</Label>
          <Textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optionale Beschreibung der Kompetenz"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Zertifizierungen</Label>
          <TagInput
            items={certifications}
            setItems={setCertifications}
            placeholder="Zertifizierung eingeben (z.B. AWS Certified)"
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
