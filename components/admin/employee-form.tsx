'use client';

import { Plus, X } from 'lucide-react';

import { Loader } from '@/components/ai-elements/loader';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

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
import { createEmployee } from '@/lib/master-data/actions';

interface Option {
  id: string;
  name: string;
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
          onKeyPress={e => e.key === 'Enter' && handleAdd()}
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

export function EmployeeForm({
  businessUnits,
  _competencies,
}: {
  businessUnits: Option[] | undefined;
  _competencies: Option[] | undefined;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [businessUnitId, setBusinessUnitId] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>(['developer']);
  const [availability, setAvailability] = useState<'available' | 'on_project' | 'unavailable'>(
    'available'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name.trim() ||
      !email.trim() ||
      !businessUnitId ||
      skills.length === 0 ||
      roles.length === 0
    ) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createEmployee({
        name: name.trim(),
        email: email.trim(),
        businessUnitId,
        skills,
        roles,
        availabilityStatus: availability,
      });

      if (result.success) {
        toast.success('Mitarbeiter erfolgreich erstellt');
        router.push('/master-data/employees');
      } else {
        toast.error(result.error || 'Fehler beim Erstellen');
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
            placeholder="Vor- und Nachname"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-Mail *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessLine">Business Unit *</Label>
          <Select value={businessUnitId} onValueChange={setBusinessUnitId} required>
            <SelectTrigger id="businessLine" className="w-full">
              <SelectValue placeholder="Business Unit auswählen" />
            </SelectTrigger>
            <SelectContent>
              {(businessUnits || []).map(bl => (
                <SelectItem key={bl.id} value={bl.id}>
                  {bl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Skills *</Label>
          <p className="text-xs text-muted-foreground">Skills aus Kompetenzen oder frei eingeben</p>
          <TagInput items={skills} setItems={setSkills} placeholder="Skill eingeben (z.B. React)" />
        </div>

        <div className="space-y-2">
          <Label>Rollen *</Label>
          <TagInput
            items={roles}
            setItems={setRoles}
            placeholder="Rolle eingeben (z.B. developer)"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="availability">Verfügbarkeit *</Label>
          <Select
            value={availability}
            onValueChange={value =>
              setAvailability(value as 'available' | 'on_project' | 'unavailable')
            }
          >
            <SelectTrigger id="availability" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Verfügbar</SelectItem>
              <SelectItem value="on_project">Im Projekt</SelectItem>
              <SelectItem value="unavailable">Nicht verfügbar</SelectItem>
            </SelectContent>
          </Select>
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
          ) : (
            'Speichern'
          )}
        </Button>
      </div>
    </form>
  );
}
