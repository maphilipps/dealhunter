'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadPdfBid } from '@/lib/bids/actions';

interface UploadBidFormProps {
  userId: string;
}

export function UploadBidForm({ userId }: UploadBidFormProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        toast.error('Nur PDF-Dateien sind erlaubt');
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        toast.error('Nur PDF-Dateien sind erlaubt');
      }
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('source', 'reactive');
      formData.append('stage', 'rfp');

      const result = await uploadPdfBid(formData);

      if (result.success) {
        toast.success('PDF erfolgreich hochgeladen');
        router.push(`/bids/${result.bidId}`);
      } else {
        toast.error(result.error || 'Upload fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PDF Upload Zone */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">PDF Upload</h2>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center
            transition-colors cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${selectedFile ? 'bg-muted/50' : ''}
          `}
        >
          <input
            type="file"
            id="pdf-upload"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />

          <label htmlFor="pdf-upload" className="cursor-pointer block">
            {selectedFile ? (
              <div className="space-y-4">
                <FileText className="mx-auto h-16 w-16 text-primary" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedFile(null);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Andere Datei wählen
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="mx-auto h-16 w-16 text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">
                    PDF hierher ziehen oder klicken zum Auswählen
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Unterstützt werden PDF-Dateien bis 10 MB
                  </p>
                </div>
              </div>
            )}
          </label>
        </div>

        {selectedFile && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  PDF hochladen
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Coming Soon: Free Text & Email */}
      <div className="rounded-lg border bg-muted/50 p-6">
        <h2 className="text-xl font-semibold mb-2">Freitext & E-Mail</h2>
        <p className="text-muted-foreground">
          Bald verfügbar: Anforderungen als Freitext eingeben oder E-Mail-Inhalt einfügen
        </p>
      </div>
    </div>
  );
}
