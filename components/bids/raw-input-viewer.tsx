'use client';

import { FileText, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RawInputViewerProps {
  rawInput: string | null;
}

export function RawInputViewer({ rawInput }: RawInputViewerProps) {
  const [copied, setCopied] = useState(false);

  if (!rawInput) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawInput);
      setCopied(true);
      toast.success('Text in Zwischenablage kopiert');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  // Count characters and words
  const charCount = rawInput.length;
  const wordCount = rawInput.trim().split(/\s+/).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Extrahierter Text</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Kopiert!' : 'Kopieren'}
          </Button>
        </div>
        <CardDescription>
          {charCount.toLocaleString('de-DE')} Zeichen, {wordCount.toLocaleString('de-DE')} Wörter
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border bg-muted/30 p-4">
          <pre className="text-sm font-mono whitespace-pre-wrap break-words">{rawInput}</pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
