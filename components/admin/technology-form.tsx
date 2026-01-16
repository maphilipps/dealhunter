'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createTechnology, getBusinessLinesForSelect } from '@/lib/admin/technologies-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface BusinessLineOption {
  id: string;
  name: string;
}

interface EntityCountsProps {
  entityCounts: Record<string, number>;
  setEntityCounts: (counts: Record<string, number>) => void;
}

function EntityCountsInput({ entityCounts, setEntityCounts }: EntityCountsProps) {
  const [entityName, setEntityName] = useState('');
  const [entityCount, setEntityCount] = useState('');

  const handleAddEntity = () => {
    if (entityName.trim() && entityCount && parseInt(entityCount) > 0) {
      setEntityCounts({
        ...entityCounts,
        [entityName.trim()]: parseInt(entityCount),
      });
      setEntityName('');
      setEntityCount('');
    }
  };

  const handleRemoveEntity = (name: string) => {
    const newCounts = { ...entityCounts };
    delete newCounts[name];
    setEntityCounts(newCounts);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Entity Name (z.B. content_types)"
          value={entityName}
          onChange={(e) => setEntityName(e.target.value)}
          className="flex-1"
        />
        <Input
          type="number"
          placeholder="Anzahl"
          value={entityCount}
          onChange={(e) => setEntityCount(e.target.value)}
          className="w-24"
        />
        <Button type="button" onClick={handleAddEntity} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {Object.keys(entityCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(entityCounts).map(([name, count]) => (
            <Badge key={name} variant="secondary" className="text-sm">
              {name}: {count}
              <button
                type="button"
                onClick={() => handleRemoveEntity(name)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface TechnologyFormProps {
  businessLines: BusinessLineOption[] | undefined;
}

export function TechnologyForm({ businessLines }: TechnologyFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [businessLineId, setBusinessLineId] = useState('');
  const [baselineHours, setBaselineHours] = useState('');
  const [baselineName, setBaselineName] = useState('');
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !businessLineId || !baselineHours || !baselineName.trim() || Object.keys(entityCounts).length === 0) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createTechnology({
        name: name.trim(),
        businessLineId,
        baselineHours: parseInt(baselineHours),
        baselineName: baselineName.trim(),
        baselineEntityCounts: entityCounts,
        isDefault,
      });

      if (result.success) {
        toast.success('Technologie erfolgreich erstellt');
        router.push('/admin/technologies');
        router.refresh();
      } else {
        toast.error(result.error || 'Fehler beim Erstellen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Create technology error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Technologie Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Drupal"
          />
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
              <option key={bl.id} value={bl.id}>
                {bl.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baselineHours">Baseline Stunden *</Label>
          <Input
            id="baselineHours"
            type="number"
            value={baselineHours}
            onChange={(e) => setBaselineHours(e.target.value)}
            placeholder="z.B. 693"
            min="1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="baselineName">Baseline Name *</Label>
          <Input
            id="baselineName"
            value={baselineName}
            onChange={(e) => setBaselineName(e.target.value)}
            placeholder="z.B. adessoCMS"
          />
        </div>

        <div className="space-y-2">
          <Label>Baseline Entity Counts *</Label>
          <p className="text-xs text-muted-foreground">
            Fügen Sie Entity-Typen mit ihren Anzahlen hinzu
          </p>
          <EntityCountsInput entityCounts={entityCounts} setEntityCounts={setEntityCounts} />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isDefault"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="isDefault" className="cursor-pointer">
            Als Default für diese Business Line setzen
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Abbrechen
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
