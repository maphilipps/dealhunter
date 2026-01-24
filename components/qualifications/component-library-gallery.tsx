'use client';

import { Code2, ExternalLink, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Component } from '@/lib/agents/component-library-agent';

export interface ComponentLibraryGalleryProps {
  components: Component[];
  totalComponents: number;
  pagesAnalyzed: number;
}

/**
 * Component Library Gallery (DEA-147)
 *
 * Displays detected UI components in a gallery view with:
 * - Grid layout with component cards
 * - Screenshots (when available)
 * - Component metadata (name, description, props, usage)
 * - Tabs for different views (Grid, List, Properties)
 */
export function ComponentLibraryGallery({
  components,
  totalComponents,
  pagesAnalyzed,
}: ComponentLibraryGalleryProps) {
  if (components.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Keine Komponenten gefunden</CardTitle>
          <CardDescription>
            Die Analyse hat keine wiederverwendbaren UI-Komponenten gefunden.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Komponenten</CardDescription>
            <CardTitle className="text-3xl">{totalComponents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Seiten analysiert</CardDescription>
            <CardTitle className="text-3xl">{pagesAnalyzed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Durchschnitt</CardDescription>
            <CardTitle className="text-3xl">
              {(totalComponents / pagesAnalyzed).toFixed(1)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Component Gallery */}
      <Tabs defaultValue="grid" className="w-full">
        <TabsList>
          <TabsTrigger value="grid">Grid Ansicht</TabsTrigger>
          <TabsTrigger value="list">Listen Ansicht</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {components.map((component, idx) => (
              <ComponentCard key={`${component.pageUrl}-${idx}`} component={component} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <div className="space-y-4">
            {components.map((component, idx) => (
              <ComponentListItem key={`${component.pageUrl}-${idx}`} component={component} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Component Card for Grid View
 */
function ComponentCard({ component }: { component: Component }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{component.name}</CardTitle>
            <CardDescription className="line-clamp-2">{component.description}</CardDescription>
          </div>
          <Code2 className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Screenshot */}
        {component.screenshotBase64 && (
          <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
            <Image
              src={`data:image/png;base64,${component.screenshotBase64}`}
              alt={`Screenshot of ${component.name}`}
              fill
              className="object-cover object-top"
            />
          </div>
        )}

        {!component.screenshotBase64 && (
          <div className="flex aspect-video items-center justify-center rounded-md border bg-muted">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

        {/* Usage Context */}
        <div className="space-y-2">
          <div className="text-sm">
            <span className="font-medium">Verwendung:</span>
            <p className="mt-1 text-muted-foreground">{component.usageContext}</p>
          </div>

          {/* Estimated Props */}
          {component.estimatedProps && Object.keys(component.estimatedProps).length > 0 && (
            <div className="space-y-1">
              <span className="text-sm font-medium">Props:</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(component.estimatedProps).map(([key, type]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Source Page */}
          <a
            href={component.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            Quelle ansehen
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Component List Item for List View
 */
function ComponentListItem({ component }: { component: Component }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-6">
          {/* Screenshot Thumbnail */}
          {component.screenshotBase64 && (
            <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-md border">
              <Image
                src={`data:image/png;base64,${component.screenshotBase64}`}
                alt={`Screenshot of ${component.name}`}
                fill
                className="object-cover object-top"
              />
            </div>
          )}

          {!component.screenshotBase64 && (
            <div className="flex h-24 w-32 flex-shrink-0 items-center justify-center rounded-md border bg-muted">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Component Info */}
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold">{component.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{component.description}</p>
            </div>

            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Verwendung:</span>{' '}
                <span className="text-muted-foreground">{component.usageContext}</span>
              </div>

              {component.estimatedProps && Object.keys(component.estimatedProps).length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Props:</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(component.estimatedProps).map(([key, type]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}: {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <a
                href={component.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                {component.pageUrl}
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
