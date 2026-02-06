'use client';

import { RotateCcw, Save } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { AIModelsTab } from '@/components/admin/ai-models-tab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { type ConfigKey, getConfigs, setConfig, deleteConfig } from '@/lib/admin/config-actions';
import type { Config } from '@/lib/db/schema';
import {
  BIT_EVALUATION_WEIGHTS,
  BIT_THRESHOLD,
  CMS_SCORING_WEIGHTS,
  CMS_SIZE_AFFINITY,
  CMS_INDUSTRY_AFFINITY,
  TECH_TO_BU_MAPPING,
} from '@/lib/config/business-rules';

type ConfigDefinition = {
  key: ConfigKey;
  label: string;
  description: string;
  category: Config['category'];
  defaultValue: unknown;
};

const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  {
    key: 'bit_weights',
    label: 'BIT Evaluation Weights',
    description: 'Gewichtung der BID/NO-BID Faktoren (Summe = 1.0)',
    category: 'bit_evaluation',
    defaultValue: BIT_EVALUATION_WEIGHTS,
  },
  {
    key: 'bit_threshold',
    label: 'BIT Threshold',
    description: 'Mindest-Score für BID-Empfehlung (0-100)',
    category: 'bit_evaluation',
    defaultValue: BIT_THRESHOLD,
  },
  {
    key: 'cms_scoring_weights',
    label: 'CMS Scoring Weights',
    description: 'Gewichtung der CMS-Matching Faktoren (Summe = 1.0)',
    category: 'cms_scoring',
    defaultValue: CMS_SCORING_WEIGHTS,
  },
  {
    key: 'cms_size_affinity',
    label: 'CMS Size Affinity',
    description: 'Größenbasierte CMS-Eignung nach Seitenanzahl',
    category: 'cms_scoring',
    defaultValue: CMS_SIZE_AFFINITY,
  },
  {
    key: 'cms_industry_affinity',
    label: 'CMS Industry Affinity',
    description: 'Branchenspezifische CMS-Präferenzen (0-100)',
    category: 'cms_scoring',
    defaultValue: CMS_INDUSTRY_AFFINITY,
  },
  {
    key: 'tech_to_bu_mapping',
    label: 'Tech → BU Mapping',
    description: 'Technologie zu Business Unit Zuordnung',
    category: 'routing',
    defaultValue: TECH_TO_BU_MAPPING,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  bit_evaluation: 'BIT Evaluation',
  cms_scoring: 'CMS Scoring',
  routing: 'Routing',
  system: 'System',
};

export default function ConfigsPage() {
  const [dbConfigs, setDbConfigs] = useState<Config[]>([]);
  const [editState, setEditState] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadConfigs = useCallback(async () => {
    const configs = await getConfigs();
    setDbConfigs(configs);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const getDbValue = (key: string): Config | undefined => dbConfigs.find(c => c.key === key);

  const getDisplayValue = (def: ConfigDefinition): string => {
    const dbConfig = getDbValue(def.key);
    if (dbConfig) return dbConfig.value;
    return JSON.stringify(def.defaultValue, null, 2);
  };

  const isOverridden = (key: string): boolean => dbConfigs.some(c => c.key === key);

  const startEditing = (key: string, currentValue: string) => {
    try {
      const formatted = JSON.stringify(JSON.parse(currentValue), null, 2);
      setEditState(prev => ({ ...prev, [key]: formatted }));
    } catch {
      setEditState(prev => ({ ...prev, [key]: currentValue }));
    }
  };

  const cancelEditing = (key: string) => {
    setEditState(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async (def: ConfigDefinition) => {
    const value = editState[def.key];
    if (value === undefined) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      toast.error('Ungültiges JSON-Format');
      return;
    }

    setSavingKeys(prev => new Set(prev).add(def.key));

    const result = await setConfig(def.key, parsed, {
      category: def.category,
      description: def.description,
    });

    setSavingKeys(prev => {
      const next = new Set(prev);
      next.delete(def.key);
      return next;
    });

    if (result.success) {
      toast.success(`${def.label} gespeichert`);
      cancelEditing(def.key);
      await loadConfigs();
    } else {
      toast.error(result.error || 'Fehler beim Speichern');
    }
  };

  const handleReset = async (def: ConfigDefinition) => {
    if (!confirm(`"${def.label}" auf Standardwert zurücksetzen?`)) return;

    setSavingKeys(prev => new Set(prev).add(def.key));

    const result = await deleteConfig(def.key);

    setSavingKeys(prev => {
      const next = new Set(prev);
      next.delete(def.key);
      return next;
    });

    if (result.success) {
      toast.success(`${def.label} zurückgesetzt`);
      cancelEditing(def.key);
      await loadConfigs();
    } else {
      toast.error(result.error || 'Fehler beim Zurücksetzen');
    }
  };

  if (isLoading) {
    return <div className="p-8">Lade...</div>;
  }

  const categories = [...new Set(CONFIG_DEFINITIONS.map(d => d.category))];

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Business Rules Konfiguration</h1>
          <p className="text-muted-foreground">
            BIT Scoring, CMS Matching und Routing-Regeln anpassen. Änderungen werden sofort wirksam.
          </p>
        </div>

        <Tabs defaultValue={categories[0]}>
          <TabsList>
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </TabsTrigger>
            ))}
            <TabsTrigger value="ai_models">AI Modelle</TabsTrigger>
          </TabsList>

          {categories.map(cat => (
            <TabsContent key={cat} value={cat} className="space-y-4">
              {CONFIG_DEFINITIONS.filter(d => d.category === cat).map(def => {
                const isEditing = def.key in editState;
                const isSaving = savingKeys.has(def.key);
                const overridden = isOverridden(def.key);
                const dbConfig = getDbValue(def.key);

                return (
                  <Card key={def.key}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                          {def.label}
                          {overridden ? (
                            <Badge variant="default">Angepasst</Badge>
                          ) : (
                            <Badge variant="outline">Standard</Badge>
                          )}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{def.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {overridden && !isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReset(def)}
                            disabled={isSaving}
                          >
                            <RotateCcw className="mr-1 h-4 w-4" />
                            Zurücksetzen
                          </Button>
                        )}
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelEditing(def.key)}
                              disabled={isSaving}
                            >
                              Abbrechen
                            </Button>
                            <Button size="sm" onClick={() => handleSave(def)} disabled={isSaving}>
                              <Save className="mr-1 h-4 w-4" />
                              Speichern
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(def.key, getDisplayValue(def))}
                          >
                            Bearbeiten
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isEditing ? (
                        <Textarea
                          className="font-mono text-sm"
                          rows={Math.min(
                            20,
                            Math.max(5, editState[def.key].split('\n').length + 2)
                          )}
                          value={editState[def.key]}
                          onChange={e =>
                            setEditState(prev => ({
                              ...prev,
                              [def.key]: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <pre className="bg-muted rounded-md p-4 text-sm font-mono overflow-x-auto">
                          {getDisplayValue(def)}
                        </pre>
                      )}
                      {dbConfig && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Version {dbConfig.version} — Zuletzt geändert{' '}
                          {dbConfig.updatedAt
                            ? new Date(dbConfig.updatedAt).toLocaleString('de-DE')
                            : 'unbekannt'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          ))}
          <TabsContent value="ai_models">
            <AIModelsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
