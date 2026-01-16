'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createEmployee } from '@/lib/admin/employees-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Option {
  id: string;
  name: string;
}

function TagInput({ items, setItems, placeholder }: { items: string[], setItems: (items: string[]) => void, placeholder: string }) {
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
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1"
        />
        <Button type="button" onClick={handleAdd} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="text-sm">
              {item}
              <button type="button" onClick={() => setItems(items.filter((i) => i !== item))} className="ml-1">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmployeeForm({ businessLines, competencies }: { businessLines: Option[] | undefined, competencies: Option[] | undefined }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [businessLineId, setBusinessLineId] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>(['developer']);
  const [availability, setAvailability] = useState<'available' | 'on_project' | 'unavailable'>('available');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !businessLineId || skills.length === 0 || roles.length === 0) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createEmployee({
        name: name.trim(),
        email: email.trim(),
        businessLineId,
        skills,
        roles,
        availabilityStatus: availability,
      });

      if (result.success) {
        toast.success('Mitarbeiter erfolgreich erstellt');
        router.push('/admin/employees');
      } else {
        toast.error(result.error || 'Fehler beim Erstellen');
      }
    } catch (error) {
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
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-Mail *</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessLine">Business Line *</Label>
          <select
            id="businessLine"
            value={businessLineId}
            onChange={(e) => setBusinessLineId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          >
            <option value="">Business Line auswählen</option>
            {(businessLines || []).map((bl) => (
              <option key={bl.id} value={bl.id}>{bl.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Skills *</Label>
          <p className="text-xs text-muted-foreground">Skills aus Kompetenzen oder frei eingeben</p>
          <TagInput items={skills} setItems={setSkills} placeholder="Skill eingeben (z.B. React)" />
        </div>

        <div className="space-y-2">
          <Label>Rollen *</Label>
          <TagInput items={roles} setItems={setRoles} placeholder="Rolle eingeben (z.B. developer)" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="availability">Verfügbarkeit *</Label>
          <select
            id="availability"
            value={availability}
            onChange={(e) => setAvailability(e.target.value as any)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="available">Verfügbar</option>
            <option value="on_project">Im Projekt</option>
            <option value="unavailable">Nicht verfügbar</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Abbrechen</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Wird gespeichert...</> : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}
