'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2, Globe, Type } from 'lucide-react';
import { toast } from 'sonner';
import { uploadCombinedBid } from '@/lib/bids/actions';

interface UploadBidFormProps {
  userId: string;
  accounts: Array<{ id: string; name: string; industry: string }>;
}

export function UploadBidForm({ userId, accounts }: UploadBidFormProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [additionalText, setAdditionalText] = useState('');
  const [enableDSGVO, setEnableDSGVO] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

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

  const handleSubmit = async () => {
    // Validate at least one input
    if (!selectedFile && !websiteUrl.trim() && !additionalText.trim()) {
      toast.error('Mindestens eine Eingabe (PDF, URL oder Text) ist erforderlich');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (websiteUrl.trim()) {
        formData.append('websiteUrl', websiteUrl.trim());
      }

      if (additionalText.trim()) {
        formData.append('additionalText', additionalText.trim());
      }

      formData.append('source', 'reactive');
      formData.append('stage', 'rfp');
      formData.append('enableDSGVO', enableDSGVO.toString());

      if (selectedAccountId) {
        formData.append('accountId', selectedAccountId);
      }

      const result = await uploadCombinedBid(formData);

      if (result.success) {
        if (result.piiRemoved) {
          toast.success('Erfolgreich hochgeladen (persönliche Daten entfernt)');
        } else {
          toast.success('Erfolgreich hochgeladen');
        }
        router.push(`/rfps/${result.bidId}`);
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

  const hasAnyInput = selectedFile || websiteUrl.trim() || additionalText.trim();

  return (
    <div className="space-y-6">
      {/* Account Selection */}
      <div className="rounded-lg border bg-card p-4">
        <label htmlFor="account-select" className="block text-sm font-medium mb-2">
          Account zuordnen (optional)
        </label>
        <select
          id="account-select"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          disabled={isUploading}
        >
          <option value="">-- Kein Account ausgewählt --</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.industry})
            </option>
          ))}
        </select>
      </div>

      {/* Section 1: PDF Upload */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">PDF Upload</h2>
          <span className="text-sm text-muted-foreground">(optional)</span>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center
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
              <div className="space-y-3">
                <FileText className="mx-auto h-12 w-12 text-primary" />
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
              <div className="space-y-3">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="font-medium">
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
          <div className="mt-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
              <input
                type="checkbox"
                id="dsgvo-cleaning"
                checked={enableDSGVO}
                onChange={(e) => setEnableDSGVO(e.target.checked)}
                disabled={isUploading}
                className="h-4 w-4"
              />
              <label htmlFor="dsgvo-cleaning" className="text-sm font-medium cursor-pointer">
                DSGVO-Bereinigung aktivieren (persönliche Daten entfernen)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Website URL */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Website-URL</h2>
          <span className="text-sm text-muted-foreground">(optional, aber empfohlen)</span>
        </div>

        <div>
          <label htmlFor="website-url" className="block text-sm font-medium mb-2">
            Kunden-Website für Quick Scan
          </label>
          <input
            id="website-url"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://www.beispiel-kunde.de"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isUploading}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Die URL wird für die automatische Tech-Stack-Analyse verwendet
          </p>
        </div>
      </div>

      {/* Section 3: Additional Text */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Type className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Zusätzliche Informationen</h2>
          <span className="text-sm text-muted-foreground">(optional)</span>
        </div>

        <div>
          <label htmlFor="additional-text" className="block text-sm font-medium mb-2">
            Weitere Details oder Projektbeschreibung
          </label>
          <textarea
            id="additional-text"
            value={additionalText}
            onChange={(e) => setAdditionalText(e.target.value)}
            placeholder="Ergänzende Informationen, die nicht im PDF stehen oder zusätzlichen Kontext bieten..."
            rows={8}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
            disabled={isUploading}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {additionalText.length} Zeichen
          </p>
        </div>
      </div>

      {/* Submit Section */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {hasAnyInput ? (
              <span className="text-green-600 font-medium">
                ✓ Mindestens eine Eingabe vorhanden
              </span>
            ) : (
              <span className="text-amber-600 font-medium">
                ⚠ Mindestens eine Eingabe erforderlich
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading || !hasAnyInput}
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Wird verarbeitet...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Bid erstellen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
