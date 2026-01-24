'use client';

import { Upload, FileText, Loader2, Globe, Type, X, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { uploadCombinedBid } from '@/lib/bids/actions';

interface UploadBidFormProps {
  userId: string;
  accounts: Array<{ id: string; name: string; industry: string }>;
}

export function UploadBidForm({ userId: _userId, accounts }: UploadBidFormProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [websiteUrls, setWebsiteUrls] = useState<string[]>(['']);
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

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
      toast.error('Nur PDF-Dateien sind erlaubt');
      return;
    }

    if (pdfFiles.length !== files.length) {
      toast.warning(`${files.length - pdfFiles.length} Nicht-PDF-Dateien wurden ignoriert`);
    }

    setSelectedFiles(prev => [...prev, ...pdfFiles]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
      toast.error('Nur PDF-Dateien sind erlaubt');
      return;
    }

    setSelectedFiles(prev => [...prev, ...pdfFiles]);
    e.target.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addUrlField = useCallback(() => {
    setWebsiteUrls(prev => [...prev, '']);
  }, []);

  const updateUrl = useCallback((index: number, value: string) => {
    setWebsiteUrls(prev => prev.map((url, i) => (i === index ? value : url)));
  }, []);

  const removeUrl = useCallback((index: number) => {
    setWebsiteUrls(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));
  }, []);

  const handleSubmit = async () => {
    const validUrls = websiteUrls.filter(url => url.trim());

    if (selectedFiles.length === 0 && validUrls.length === 0 && !additionalText.trim()) {
      toast.error('Mindestens eine Eingabe (PDF, URL oder Text) ist erforderlich');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();

      for (const file of selectedFiles) {
        formData.append('files', file);
      }

      for (const url of validUrls) {
        formData.append('websiteUrls', url);
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
        const fileCount = selectedFiles.length;
        const urlCount = validUrls.length;
        const hasText = additionalText.trim().length > 0;

        let message = 'Erfolgreich hochgeladen';
        if (fileCount > 1 || urlCount > 1 || (fileCount >= 1 && urlCount >= 1)) {
          const parts = [];
          if (fileCount > 0) parts.push(`${fileCount} PDF${fileCount > 1 ? 's' : ''}`);
          if (urlCount > 0) parts.push(`${urlCount} URL${urlCount > 1 ? 's' : ''}`);
          if (hasText) parts.push('Text');
          message = `${parts.join(' + ')} kombiniert`;
        }

        if (result.piiRemoved) {
          message += ' (persönliche Daten entfernt)';
        }

        toast.success(message);
        router.push(`/pre-qualifications/${result.bidId}`);
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

  const validUrls = websiteUrls.filter(url => url.trim());
  const hasAnyInput = selectedFiles.length > 0 || validUrls.length > 0 || additionalText.trim();
  const totalFileSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-primary">
            RFP Eingabe - Kombinieren Sie beliebig viele Quellen
          </CardTitle>
          <CardDescription>
            Alle Quellen werden zu einem ganzheitlichen Input für die AI-Analyse kombiniert.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Account + URLs */}
        <div className="space-y-6">
          {/* Account Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">Account zuordnen</CardTitle>
              <CardDescription>Optional: Bestehenden Account verknüpfen</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                disabled={isUploading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Kein Account ausgewählt --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Kein Account ausgewählt --</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.industry})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Website URLs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Website-URLs
              </CardTitle>
              <CardDescription>Für automatische Tech-Stack-Analyse (empfohlen)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {websiteUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="url"
                    value={url}
                    onChange={e => updateUrl(index, e.target.value)}
                    placeholder={
                      index === 0 ? 'https://www.kunde.de' : 'Weitere URL (z.B. LinkedIn)'
                    }
                    disabled={isUploading}
                  />
                  {websiteUrls.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUrl(index)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addUrlField}
                disabled={isUploading}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Weitere URL hinzufügen
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Files + Freetext */}
        <div className="space-y-6">
          {/* PDF Upload */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    PDF Dokumente
                  </CardTitle>
                  <CardDescription>RFP, Anhänge, E-Mails als PDF</CardDescription>
                </div>
                {selectedFiles.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {selectedFiles.length} Datei{selectedFiles.length > 1 ? 'en' : ''} (
                    {(totalFileSize / 1024 / 1024).toFixed(1)} MB)
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Uploaded Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-muted/50"
                    >
                      <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                  ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                `}
              >
                <input
                  type="file"
                  id="pdf-upload"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />

                <label htmlFor="pdf-upload" className="cursor-pointer block">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    {selectedFiles.length > 0 ? 'Weitere PDFs hinzufügen' : 'PDFs hierher ziehen'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    oder klicken (max. 10 MB/Datei)
                  </p>
                </label>
              </div>

              {/* DSGVO Checkbox */}
              {selectedFiles.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dsgvo-cleaning"
                    checked={enableDSGVO}
                    onCheckedChange={checked => setEnableDSGVO(checked === true)}
                    disabled={isUploading}
                  />
                  <Label htmlFor="dsgvo-cleaning" className="text-sm">
                    DSGVO-Bereinigung (persönliche Daten entfernen)
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Freetext */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Type className="h-5 w-5 text-primary" />
                Freitext / E-Mail
              </CardTitle>
              <CardDescription>Zusätzliche Informationen oder E-Mail-Inhalt</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={additionalText}
                onChange={e => setAdditionalText(e.target.value)}
                placeholder="Kopieren Sie hier den RFP-Text oder E-Mail-Inhalt ein..."
                rows={6}
                disabled={isUploading}
                className="resize-y"
              />
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {additionalText.length} Zeichen
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {hasAnyInput ? (
                <div className="space-y-1">
                  <span className="text-green-600 font-medium">✓ Eingaben vorhanden:</span>
                  <div className="text-muted-foreground text-xs flex gap-2">
                    {selectedFiles.length > 0 && (
                      <span>
                        {selectedFiles.length} PDF{selectedFiles.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {validUrls.length > 0 && (
                      <span>
                        {validUrls.length} URL{validUrls.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {additionalText.trim() && <span>+ Text</span>}
                  </div>
                </div>
              ) : (
                <span className="text-amber-600 font-medium">
                  ⚠ Mindestens eine Eingabe erforderlich
                </span>
              )}
            </div>

            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isUploading || !hasAnyInput}
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird verarbeitet...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Bid erstellen
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
