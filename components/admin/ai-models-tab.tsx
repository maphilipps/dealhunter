'use client';

import { AlertCircle, Bot, Check, Eye, EyeOff, KeyRound, Loader2, RotateCcw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  fetchProviderModels,
  getAIProviders,
  getModelSlots,
  updateAIProvider,
  updateModelSlot,
  resetModelSlot,
  type AIProviderForUI,
  type ModelSlotWithProvider,
  type ProviderModel,
} from '@/lib/admin/ai-config-actions';

// ─── Known models per provider (for the picker) ─────────────────────────────────

type ModelDef = { name: string; description: string };

const KNOWN_MODELS: Record<string, ModelDef[]> = {
  openai: [
    { name: 'gpt-5.2-pro', description: 'GPT-5.2 Pro — Top reasoning' },
    { name: 'gpt-5.2', description: 'GPT-5.2 — Balance' },
    { name: 'gpt-5.2-chat-latest', description: 'GPT-5.2 Chat — Fast' },
    { name: 'gpt-4o', description: 'GPT-4o — Multimodal' },
    { name: 'gpt-4o-mini', description: 'GPT-4o Mini — Lightweight' },
    { name: 'o3', description: 'o3 — Deep reasoning' },
    { name: 'o3-mini', description: 'o3 Mini — Efficient reasoning' },
    { name: 'o4-mini', description: 'o4 Mini — Latest reasoning' },
  ],
  'ai-hub': [
    { name: 'claude-sonnet-4-5-20250929', description: 'Claude Sonnet 4.5' },
    { name: 'claude-sonnet-4-20250514', description: 'Claude Sonnet 4' },
    { name: 'claude-haiku-4-5-20251001', description: 'Claude Haiku 4.5' },
    { name: 'gemini-2.5-pro-preview-05-06', description: 'Gemini 2.5 Pro' },
    { name: 'gemini-2.5-flash-preview-04-17', description: 'Gemini 2.5 Flash' },
    { name: 'gpt-5.2-pro', description: 'GPT-5.2 Pro (via Hub)' },
    { name: 'gpt-5.2', description: 'GPT-5.2 (via Hub)' },
    { name: 'gpt-4o', description: 'GPT-4o (via Hub)' },
  ],
  vercel: [
    { name: 'claude-sonnet-4-5-20250929', description: 'Claude Sonnet 4.5' },
    { name: 'gpt-5.2', description: 'GPT-5.2' },
    { name: 'gemini-2.5-pro-preview-05-06', description: 'Gemini 2.5 Pro' },
  ],
};

const SLOT_LABELS: Record<string, string> = {
  fast: 'Fast',
  default: 'Default',
  quality: 'Quality',
  premium: 'Premium',
  synthesizer: 'Synthesizer',
  research: 'Research',
  vision: 'Vision',
  embedding: 'Embedding',
  'web-search': 'Web Search',
};

const SLOT_DESCRIPTIONS: Record<string, string> = {
  fast: 'Schnelle Antworten, niedrige Latenz',
  default: 'Standard-Agent-Aufgaben',
  quality: 'Hochwertige Analysen',
  premium: 'Komplexe Reasoning-Aufgaben',
  synthesizer: 'Zusammenfassungen & Reports',
  research: 'Deep Research & Exploration',
  vision: 'Bild- & PDF-Analyse',
  embedding: 'Text-Embeddings',
  'web-search': 'Web-Suche & Recherche',
};

const PROVIDER_LOGO_MAP: Record<string, string> = {
  'ai-hub': 'openai',
  openai: 'openai',
  vercel: 'vercel',
};

// ─── Dynamic Model Fetching ──────────────────────────────────────────────────────

const MODEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const modelCache = new Map<string, { models: ProviderModel[]; fetchedAt: number }>();

export function invalidateModelCache(providerId?: string) {
  if (providerId) {
    modelCache.delete(providerId);
  } else {
    modelCache.clear();
  }
}

function useProviderModels(providerId: string, providerKey: string, open: boolean) {
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const cached = modelCache.get(providerId);
    if (cached && Date.now() - cached.fetchedAt < MODEL_CACHE_TTL) {
      setModels(cached.models);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchProviderModels(providerId).then(result => {
      if (cancelled) return;
      setIsLoading(false);
      if (result.success) {
        modelCache.set(providerId, { models: result.models, fetchedAt: Date.now() });
        setModels(result.models);
        setError(null);
      } else {
        setError(result.error);
        // Fallback: use KNOWN_MODELS
        const fallback = KNOWN_MODELS[providerKey] || [];
        setModels(fallback.map(m => ({ id: m.name, ownedBy: '' })));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [providerId, providerKey, open]);

  return { models, error, isLoading };
}

// ─── Provider Card ───────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  isSaving,
  onUpdate,
}: {
  provider: AIProviderForUI;
  isSaving: boolean;
  onUpdate: () => Promise<void>;
}) {
  const [editingField, setEditingField] = useState<'apiKey' | 'baseUrl' | null>(null);
  const [fieldValue, setFieldValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (field: 'apiKey' | 'baseUrl') => {
    setSaving(true);
    const result = await updateAIProvider(provider.id, {
      [field]: fieldValue || null,
    });
    setSaving(false);
    if (result.success) {
      toast.success(
        `${provider.providerKey} ${field === 'apiKey' ? 'API Key' : 'Base URL'} gespeichert`
      );
      setEditingField(null);
      setShowKey(false);

      // Validate connection after key/URL change
      invalidateModelCache(provider.id);
      if (field === 'apiKey' && fieldValue) {
        const check = await fetchProviderModels(provider.id);
        if (check.success) {
          toast.success(`Verbindung OK — ${check.models.length} Modelle verfügbar`);
        } else {
          toast.error(`Verbindung fehlgeschlagen: ${check.error}`);
        }
      }

      await onUpdate();
    } else {
      toast.error(result.error || 'Fehler');
    }
  };

  const handleToggle = async () => {
    const result = await updateAIProvider(provider.id, { isEnabled: !provider.isEnabled });
    if (result.success) {
      toast.success(`${provider.providerKey} ${!provider.isEnabled ? 'aktiviert' : 'deaktiviert'}`);
      await onUpdate();
    } else {
      toast.error(result.error || 'Fehler');
    }
  };

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ModelSelectorLogo
              provider={PROVIDER_LOGO_MAP[provider.providerKey] || provider.providerKey}
              className="size-5"
            />
            <span className="font-semibold">{provider.providerKey}</span>
            {!provider.isEnabled && (
              <Badge variant="outline" className="text-muted-foreground">
                Deaktiviert
              </Badge>
            )}
          </div>
          <Switch checked={provider.isEnabled} onCheckedChange={handleToggle} disabled={isSaving} />
        </div>

        {/* API Key row */}
        <div className="flex items-center gap-2 text-sm">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {editingField === 'apiKey' ? (
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Input
                  className="h-8 text-sm pr-8 font-mono"
                  type={showKey ? 'text' : 'password'}
                  value={fieldValue}
                  onChange={e => setFieldValue(e.target.value)}
                  placeholder="sk-..."
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-8 w-8 p-0"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => handleSave('apiKey')}
                disabled={saving}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setEditingField(null);
                  setShowKey(false);
                }}
              >
                Abbrechen
              </Button>
            </div>
          ) : (
            <button
              className="text-muted-foreground hover:text-foreground transition-colors text-left"
              onClick={() => {
                setEditingField('apiKey');
                setFieldValue('');
              }}
            >
              {provider.hasApiKey ? (
                <span className="font-mono">{provider.apiKeyPreview}</span>
              ) : (
                <span className="italic">Kein API Key gesetzt — klicken zum Setzen</span>
              )}
            </button>
          )}
        </div>

        {/* Base URL row */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground shrink-0 text-xs w-3.5 text-center">URL</span>
          {editingField === 'baseUrl' ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                className="h-8 text-sm flex-1 font-mono"
                value={fieldValue}
                onChange={e => setFieldValue(e.target.value)}
                placeholder="https://api.example.com/v1"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => handleSave('baseUrl')}
                disabled={saving}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setEditingField(null)}
              >
                Abbrechen
              </Button>
            </div>
          ) : (
            <button
              className="text-muted-foreground hover:text-foreground transition-colors font-mono text-xs text-left"
              onClick={() => {
                setEditingField('baseUrl');
                setFieldValue(provider.baseUrl || '');
              }}
            >
              {provider.baseUrl || 'Standard-URL — klicken zum Ändern'}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Provider Model Group (uses Hook for dynamic fetching) ──────────────────────

function ProviderModelGroup({
  provider,
  open,
  currentSlot,
  onSelectModel,
}: {
  provider: AIProviderForUI;
  open: boolean;
  currentSlot: ModelSlotWithProvider;
  onSelectModel: (providerId: string, modelName: string) => void;
}) {
  const { models, error, isLoading } = useProviderModels(provider.id, provider.providerKey, open);

  const heading = (
    <span className="flex items-center gap-1.5">
      <ModelSelectorLogo
        provider={PROVIDER_LOGO_MAP[provider.providerKey] || provider.providerKey}
        className="size-3"
      />
      {provider.providerKey}
      {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {error && !isLoading && (
        <span className="flex items-center gap-1 text-destructive text-[10px] font-normal">
          <AlertCircle className="h-3 w-3" />
          Fallback
        </span>
      )}
      {!isLoading && !error && models.length > 0 && (
        <span className="text-[10px] font-normal text-muted-foreground">{models.length}</span>
      )}
    </span>
  );

  if (models.length === 0 && !isLoading) return null;

  return (
    <ModelSelectorGroup heading={heading}>
      {isLoading && (
        <div className="px-2 py-3 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Modelle werden geladen...
        </div>
      )}
      {error && !isLoading && <div className="px-2 py-1 text-xs text-destructive">{error}</div>}
      {models.map(model => (
        <ModelSelectorItem
          key={`${provider.id}-${model.id}`}
          onSelect={() => onSelectModel(provider.id, model.id)}
          className="flex items-center gap-2"
        >
          <ModelSelectorName>{model.id}</ModelSelectorName>
          {model.ownedBy && <span className="text-xs text-muted-foreground">{model.ownedBy}</span>}
          {currentSlot.providerId === provider.id && currentSlot.modelName === model.id && (
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
        </ModelSelectorItem>
      ))}
    </ModelSelectorGroup>
  );
}

// ─── Slot Card with ModelSelector ────────────────────────────────────────────────

function SlotCard({
  slot,
  providers,
  isSaving,
  onUpdate,
}: {
  slot: ModelSlotWithProvider;
  providers: AIProviderForUI[];
  isSaving: boolean;
  onUpdate: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelectModel = async (providerId: string, modelName: string) => {
    setOpen(false);
    setSaving(true);
    const result = await updateModelSlot(slot.id, { providerId, modelName });
    setSaving(false);
    if (result.success) {
      toast.success(`${SLOT_LABELS[slot.slot] || slot.slot} → ${modelName}`);
      await onUpdate();
    } else {
      toast.error(result.error || 'Fehler');
    }
  };

  const handleReset = async () => {
    setSaving(true);
    const result = await resetModelSlot(slot.id);
    setSaving(false);
    if (result.success) {
      toast.success(`${SLOT_LABELS[slot.slot] || slot.slot} zurückgesetzt`);
      await onUpdate();
    } else {
      toast.error(result.error || 'Fehler');
    }
  };

  const enabledProviders = providers.filter(p => p.isEnabled);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                {SLOT_LABELS[slot.slot] || slot.slot}
              </CardTitle>
              {slot.isOverridden && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  Override
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{SLOT_DESCRIPTIONS[slot.slot] || ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {slot.isOverridden && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleReset}
              disabled={saving || isSaving}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <ModelSelector open={open} onOpenChange={setOpen}>
          <ModelSelectorTrigger asChild>
            <button
              className="flex items-center gap-2 w-full rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              disabled={saving || isSaving}
            >
              <ModelSelectorLogo
                provider={PROVIDER_LOGO_MAP[slot.provider.providerKey] || slot.provider.providerKey}
                className="size-4"
              />
              <span className="font-mono flex-1">{slot.modelName}</span>
              <span className="text-xs text-muted-foreground">{slot.provider.providerKey}</span>
            </button>
          </ModelSelectorTrigger>
          <ModelSelectorContent
            title={`Modell für "${SLOT_LABELS[slot.slot] || slot.slot}" wählen`}
          >
            <ModelSelectorInput placeholder="Modell suchen..." />
            <ModelSelectorList>
              <ModelSelectorEmpty>Kein Modell gefunden.</ModelSelectorEmpty>
              {enabledProviders.map(provider => (
                <ProviderModelGroup
                  key={provider.id}
                  provider={provider}
                  open={open}
                  currentSlot={slot}
                  onSelectModel={handleSelectModel}
                />
              ))}
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </CardContent>
    </Card>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────────

export function AIModelsTab() {
  const [providers, setProviders] = useState<AIProviderForUI[]>([]);
  const [slots, setSlots] = useState<ModelSlotWithProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [p, s] = await Promise.all([getAIProviders(), getModelSlots()]);
    setProviders(p);
    setSlots(s);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (isLoading) {
    return <div className="py-4">Lade AI-Konfiguration...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Provider Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Provider</h2>
        <p className="text-sm text-muted-foreground mb-4">
          API Keys, Base URLs und Verfügbarkeit der AI-Provider konfigurieren.
        </p>
        <div className="grid gap-3">
          {providers.map(provider => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isSaving={false}
              onUpdate={loadData}
            />
          ))}
          {providers.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Keine Provider konfiguriert. Tabelle <code>ai_provider_configs</code> muss
              initialisiert werden.
            </p>
          )}
        </div>
      </div>

      {/* Model Slots Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Model Slots</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Jeder Slot bestimmt, welches AI-Modell für eine bestimmte Aufgabe verwendet wird. Klicke
          auf einen Slot, um das Modell zu ändern.
        </p>
        <div className="grid gap-3">
          {slots.map(slot => (
            <SlotCard
              key={slot.id}
              slot={slot}
              providers={providers}
              isSaving={false}
              onUpdate={loadData}
            />
          ))}
          {slots.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Keine Model Slots konfiguriert. Tabelle <code>ai_model_slot_configs</code> muss
              initialisiert werden.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Provider Only Tab ───────────────────────────────────────────────────────────

export function ProvidersTab() {
  const [providers, setProviders] = useState<AIProviderForUI[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const p = await getAIProviders();
    setProviders(p);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (isLoading) {
    return <div className="py-4">Lade Provider...</div>;
  }

  return (
    <div>
      <div className="grid gap-3">
        {providers.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            isSaving={false}
            onUpdate={loadData}
          />
        ))}
        {providers.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            Keine Provider konfiguriert. Tabelle <code>ai_provider_configs</code> muss initialisiert
            werden.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Model Slots Only Tab ────────────────────────────────────────────────────────

export function ModelSlotsTab() {
  const [providers, setProviders] = useState<AIProviderForUI[]>([]);
  const [slots, setSlots] = useState<ModelSlotWithProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [p, s] = await Promise.all([getAIProviders(), getModelSlots()]);
    setProviders(p);
    setSlots(s);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (isLoading) {
    return <div className="py-4">Lade Model Slots...</div>;
  }

  return (
    <div>
      <div className="grid gap-3">
        {slots.map(slot => (
          <SlotCard
            key={slot.id}
            slot={slot}
            providers={providers}
            isSaving={false}
            onUpdate={loadData}
          />
        ))}
        {slots.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            Keine Model Slots konfiguriert. Tabelle <code>ai_model_slot_configs</code> muss
            initialisiert werden.
          </p>
        )}
      </div>
    </div>
  );
}
