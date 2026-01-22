'use client';

/**
 * Chunk Detail Dialog Component (DEA-10)
 *
 * Modal dialog showing full chunk details including content and metadata.
 */

import { Copy, Check, FileText, Bot, Hash, Clock } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AgentOutput, RawChunkItem, SimilarityResult } from '@/lib/rag/types';

type ChunkData = AgentOutput | RawChunkItem | SimilarityResult;

interface ChunkDetailDialogProps {
  chunk: ChunkData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChunkDetailDialog({ chunk, open, onOpenChange }: ChunkDetailDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!chunk) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(chunk.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAgentOutput = 'agentName' in chunk && 'chunkType' in chunk;
  const isSimilarityResult = 'similarity' in chunk && 'source' in chunk;
  const isRawChunk = !isAgentOutput && 'tokenCount' in chunk;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAgentOutput || (isSimilarityResult && chunk.source === 'agent') ? (
              <>
                <Bot className="h-5 w-5" />
                Agent Output
              </>
            ) : (
              <>
                <FileText className="h-5 w-5" />
                Raw Chunk
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Chunk ID: {chunk.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata Badges */}
          <div className="flex flex-wrap gap-2">
            {isAgentOutput && (
              <>
                <Badge variant="outline" className="font-mono">
                  <Bot className="h-3 w-3 mr-1" />
                  {chunk.agentName}
                </Badge>
                <Badge variant="secondary">
                  {chunk.chunkType}
                </Badge>
              </>
            )}

            {isSimilarityResult && chunk.agentName && (
              <>
                <Badge variant="outline" className="font-mono">
                  <Bot className="h-3 w-3 mr-1" />
                  {chunk.agentName}
                </Badge>
                {chunk.chunkType && (
                  <Badge variant="secondary">
                    {chunk.chunkType}
                  </Badge>
                )}
              </>
            )}

            <Badge variant="outline">
              <Hash className="h-3 w-3 mr-1" />
              Index: {chunk.chunkIndex}
            </Badge>

            {isSimilarityResult && (
              <Badge
                variant={chunk.similarity > 0.8 ? 'default' : chunk.similarity > 0.6 ? 'secondary' : 'outline'}
              >
                Similarity: {(chunk.similarity * 100).toFixed(1)}%
              </Badge>
            )}

            {isRawChunk && 'tokenCount' in chunk && (
              <Badge variant="outline">
                {chunk.tokenCount} Tokens
              </Badge>
            )}

            {'createdAt' in chunk && chunk.createdAt && (
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(chunk.createdAt).toLocaleString('de-DE')}
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Inhalt</h4>
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="ml-1">{copied ? 'Kopiert!' : 'Kopieren'}</span>
              </Button>
            </div>
            <ScrollArea className="h-64 rounded-md border p-4 bg-muted/50">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {chunk.content}
              </pre>
            </ScrollArea>
          </div>

          {/* Metadata JSON */}
          {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Metadata</h4>
              <ScrollArea className="h-32 rounded-md border p-4 bg-muted/50">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {JSON.stringify(chunk.metadata, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
