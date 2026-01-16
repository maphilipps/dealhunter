'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCompetitor } from '@/lib/competitors-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export function CompetitorForm() {
  const router = useRouter();
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [techFocus, setTechFocus] = useState<string[]>([]);
  const [industryFocus, setIndustryFocus] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [activeField, setActiveField] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    const name = formData.get('name') as string;
    const priceLevel = formData.get('priceLevel') as 'low' | 'medium' | 'high';

    if (!name) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    const result = await createCompetitor({
      name,
      strengths,
      weaknesses,
      technologyFocus: techFocus,
      industryFocus: industryFocus,
      priceLevel,
    });

    if (result.success) {
      toast.success('Wettbewerber erfolgreich erstellt');
      router.push('/competitors');
    } else {
      toast.error(result.error || 'Fehler beim Erstellen');
    }
  };

  const addItem = (field: string) => {
    if (input.trim()) {
      switch (field) {
        case 'strengths':
          if (!strengths.includes(input.trim())) {
            setStrengths([...strengths, input.trim()]);
          }
          break;
        case 'weaknesses':
          if (!weaknesses.includes(input.trim())) {
            setWeaknesses([...weaknesses, input.trim()]);
          }
          break;
        case 'techFocus':
          if (!techFocus.includes(input.trim())) {
            setTechFocus([...techFocus, input.trim()]);
          }
          break;
        case 'industryFocus':
          if (!industryFocus.includes(input.trim())) {
            setIndustryFocus([...industryFocus, input.trim()]);
          }
          break;
      }
      setInput('');
    }
  };

  const removeItem = (field: string, item: string) => {
    switch (field) {
      case 'strengths':
        setStrengths(strengths.filter((i) => i !== item));
        break;
      case 'weaknesses':
        setWeaknesses(weaknesses.filter((i) => i !== item));
        break;
      case 'techFocus':
        setTechFocus(techFocus.filter((i) => i !== item));
        break;
      case 'industryFocus':
        setIndustryFocus(industryFocus.filter((i) => i !== item));
        break;
    }
  };

  const renderTagInput = (field: string, label: string, placeholder: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={activeField === field ? input : ''}
          onChange={(e) => {
            setActiveField(field);
            setInput(e.target.value);
          }}
          onFocus={() => setActiveField(field)}
          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem(field))}
          placeholder={placeholder}
        />
        <Button type="button" onClick={() => addItem(field)} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(field === 'strengths' ? strengths : field === 'weaknesses' ? weaknesses : field === 'techFocus' ? techFocus : industryFocus).map((item) => (
          <Badge key={item} variant="secondary">
            {item}
            <button type="button" onClick={() => removeItem(field, item)} className="ml-1">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neuer Wettbewerber</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="z.B. Accenture, Deloitte" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priceLevel">Preisniveau *</Label>
            <select
              id="priceLevel"
              name="priceLevel"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="low">Niedrig</option>
              <option value="medium" selected>Mittel</option>
              <option value="high">Hoch</option>
            </select>
          </div>

          {renderTagInput('strengths', 'Stärken', 'z.B. Große Projekterfahrung')}
          {renderTagInput('weaknesses', 'Schwächen', 'z.B. Langsame Reaktionszeiten')}
          {renderTagInput('techFocus', 'Technologie-Fokus', 'z.B. Java, SAP, Microsoft')}
          {renderTagInput('industryFocus', 'Industrie-Fokus', 'z.B. Banking, Retail, Public Sector')}

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
