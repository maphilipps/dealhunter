'use client';

import { Monitor, Smartphone, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScreenshotData {
  homepage?: {
    desktop?: string;
    mobile?: string;
  };
  keyPages?: Array<{
    url: string;
    title: string;
    screenshot: string;
  }>;
  timestamp?: string;
}

interface ScreenshotGalleryProps {
  screenshots: ScreenshotData;
  websiteUrl?: string;
}

/**
 * Gallery view for qualification scan screenshots.
 * Shows homepage (desktop + mobile) and key page screenshots.
 */
export function ScreenshotGallery({ screenshots, websiteUrl }: ScreenshotGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const hasHomepage = screenshots.homepage?.desktop || screenshots.homepage?.mobile;
  const hasKeyPages = screenshots.keyPages && screenshots.keyPages.length > 0;

  if (!hasHomepage && !hasKeyPages) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Keine Screenshots verfügbar
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Screenshots</CardTitle>
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              Website öffnen
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="homepage">
          <TabsList className="mb-4">
            {hasHomepage && <TabsTrigger value="homepage">Startseite</TabsTrigger>}
            {hasKeyPages && (
              <TabsTrigger value="keyPages">
                Unterseiten
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {screenshots.keyPages!.length}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          {hasHomepage && (
            <TabsContent value="homepage">
              <div className="grid gap-4 md:grid-cols-2">
                {screenshots.homepage?.desktop && (
                  <ScreenshotTile
                    src={screenshots.homepage.desktop}
                    label="Desktop"
                    icon={<Monitor className="h-3.5 w-3.5" />}
                    onSelect={setSelectedImage}
                  />
                )}
                {screenshots.homepage?.mobile && (
                  <ScreenshotTile
                    src={screenshots.homepage.mobile}
                    label="Mobile"
                    icon={<Smartphone className="h-3.5 w-3.5" />}
                    onSelect={setSelectedImage}
                  />
                )}
              </div>
            </TabsContent>
          )}

          {hasKeyPages && (
            <TabsContent value="keyPages">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {screenshots.keyPages!.map((page, index) => (
                  <ScreenshotTile
                    key={index}
                    src={page.screenshot}
                    label={page.title || new URL(page.url).pathname}
                    subtitle={new URL(page.url).pathname}
                    onSelect={setSelectedImage}
                  />
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Lightbox Dialog */}
        <Dialog open={!!selectedImage} onOpenChange={open => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogTitle className="sr-only">Screenshot-Vorschau</DialogTitle>
            {selectedImage && (
              <div className="relative aspect-video w-full">
                <Image
                  src={selectedImage}
                  alt="Screenshot Vorschau"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ScreenshotTile({
  src,
  label,
  subtitle,
  icon,
  onSelect,
}: {
  src: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onSelect: (src: string) => void;
}) {
  return (
    <button
      type="button"
      className="group relative overflow-hidden rounded-lg border bg-muted/30 transition-colors hover:bg-muted/50"
      onClick={() => onSelect(src)}
    >
      <div className="relative aspect-video w-full">
        <Image src={src} alt={label} fill className="object-cover object-top" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 text-left">
        {icon}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{label}</p>
          {subtitle && <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </button>
  );
}
