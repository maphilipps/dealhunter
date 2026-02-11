'use client';

import { Settings, Sliders } from 'lucide-react';

import { ProvidersTab, ModelSlotsTab } from '@/components/admin/ai-models-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ConfigsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Modelle Konfiguration</h1>
          <p className="text-muted-foreground">
            AI-Provider und Model Slots verwalten. Änderungen werden sofort wirksam.
          </p>
        </div>

        <Tabs defaultValue="providers">
          <TabsList>
            <TabsTrigger value="providers">
              <Settings className="mr-2 h-4 w-4" />
              Provider
            </TabsTrigger>
            <TabsTrigger value="slots">
              <Sliders className="mr-2 h-4 w-4" />
              Model Slots
            </TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                API Keys, Base URLs und Verfügbarkeit der AI-Provider konfigurieren.
              </p>
            </div>
            <ProvidersTab />
          </TabsContent>

          <TabsContent value="slots" className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Jeder Slot bestimmt, welches AI-Modell für eine bestimmte Aufgabe verwendet wird.
                Klicke auf einen Slot, um das Modell zu ändern.
              </p>
            </div>
            <ModelSlotsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
