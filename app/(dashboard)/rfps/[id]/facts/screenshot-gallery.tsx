'use client';

import { Expand } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ScreenshotGalleryProps {
  screenshots: string[];
}

export function ScreenshotGallery({ screenshots }: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleThumbnailClick = (index: number) => {
    setSelectedIndex(index);
  };

  const handleClose = () => {
    setSelectedIndex(null);
  };

  return (
    <>
      {/* Thumbnail Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {screenshots.map((screenshot, index) => (
          <button
            key={index}
            onClick={() => handleThumbnailClick(index)}
            className="relative group overflow-hidden rounded-lg border border-slate-200 hover:border-blue-500 transition-all duration-200 bg-slate-50"
          >
            <div className="relative aspect-video">
              <Image
                src={screenshot}
                alt={`Screenshot ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
              {/* Overlay on Hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <Expand className="h-8 w-8 text-white" />
              </div>
            </div>
            {/* Caption */}
            <div className="p-2 text-xs text-muted-foreground text-center bg-white">
              Screenshot {index + 1}
            </div>
          </button>
        ))}
      </div>

      {/* Carousel Dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={open => !open && handleClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Screenshots</DialogTitle>
            <DialogDescription>
              Screenshot {selectedIndex !== null ? selectedIndex + 1 : 0} von {screenshots.length}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <Carousel
              opts={{
                startIndex: selectedIndex ?? 0,
                loop: true,
              }}
            >
              <CarouselContent>
                {screenshots.map((screenshot, index) => (
                  <CarouselItem key={index}>
                    <div className="relative w-full aspect-video bg-slate-100 rounded-lg overflow-hidden">
                      <Image
                        src={screenshot}
                        alt={`Screenshot ${index + 1}`}
                        fill
                        className="object-contain"
                        sizes="(max-width: 1280px) 90vw, 1200px"
                        priority={index === selectedIndex}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4" />
              <CarouselNext className="right-4" />
            </Carousel>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
