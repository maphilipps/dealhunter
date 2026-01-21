'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Loader2 } from 'lucide-react';
import { getBidDocuments } from '@/lib/bids/actions';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

interface DocumentsSidebarProps {
  bidId: string;
}

interface BidDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadSource: string;
  uploadedAt: Date;
}

export function DocumentsSidebar({ bidId }: DocumentsSidebarProps) {
  const [documents, setDocuments] = useState<BidDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDocuments() {
      const result = await getBidDocuments(bidId);
      if (result.success) {
        setDocuments(result.documents as BidDocument[]);
      } else {
        toast.error(result.error || 'Fehler beim Laden der Dokumente');
      }
      setIsLoading(false);
    }

    loadDocuments();
  }, [bidId]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = (documentId: string, fileName: string) => {
    // Open download in new tab
    window.open(`/api/documents/${documentId}/download`, '_blank');
    toast.success(`Download gestartet: ${fileName}`);
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Dokumente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Dokumente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Keine Dokumente vorhanden
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Dokumente
        </CardTitle>
        <CardDescription>
          {documents.length} {documents.length === 1 ? 'Dokument' : 'Dokumente'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.map(doc => (
          <div
            key={doc.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
            onClick={() => handleDownload(doc.id, doc.fileName)}
          >
            <div className="mt-0.5">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-medium leading-none truncate">{doc.fileName}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatFileSize(doc.fileSize)}</span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(doc.uploadedAt), {
                    addSuffix: true,
                    locale: de,
                  })}
                </span>
              </div>
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={e => {
                e.stopPropagation();
                handleDownload(doc.id, doc.fileName);
              }}
            >
              <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
