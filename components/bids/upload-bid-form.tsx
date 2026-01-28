'use client';

import { Upload, FileText, Loader2, Type, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createPendingPreQualification } from '@/lib/bids/actions';

interface UploadBidFormProps {
  userId: string;
  accounts: Array<{ id: string; name: string; industry: string }>;
}

export function UploadBidForm({ userId: _userId, accounts: _accounts }: UploadBidFormProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [additionalText, setAdditionalText] = useState('');
  const [enableDSGVO, setEnableDSGVO] = useState(false);

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
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];

    const validFiles = files.filter(file => allowedTypes.includes(file.type));

    if (validFiles.length === 0) {
      toast.error('Nur PDF-, Excel- und Word-Dateien sind erlaubt');
      return;
    }

    if (validFiles.length !== files.length) {
      toast.warning(
        `${files.length - validFiles.length} nicht unterstützte Dateien wurden ignoriert`
      );
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];

    const validFiles = Array.from(files).filter(file => allowedTypes.includes(file.type));

    if (validFiles.length === 0) {
      toast.error('Nur PDF-, Excel- und Word-Dateien sind erlaubt');
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    e.target.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 && !additionalText.trim()) {
      toast.error('Mindestens eine Eingabe (Datei oder Text) ist erforderlich');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();

      for (const file of selectedFiles) {
        formData.append('files', file);
      }

      if (additionalText.trim()) {
        formData.append('additionalText', additionalText.trim());
      }

      formData.append('source', 'reactive');
      formData.append('stage', 'pre-qualification');
      formData.append('enableDSGVO', enableDSGVO.toString());

      // Use new async-first action - creates pending entry and queues background processing
      const result = await createPendingPreQualification(formData);

      if (result.success) {
        toast.success('Verarbeitung gestartet...');
        // Navigate immediately - processing continues in background
        // Do NOT reset isUploading - let navigation handle it
        router.push(`/pre-qualifications/${result.bidId}`);
      } else {
        toast.error(result.error || 'Upload fehlgeschlagen');
        setIsUploading(false);
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Upload error:', error);
      setIsUploading(false);
    }
    // Note: No finally block - isUploading stays true until navigation completes
  };

  const hasAnyInput = selectedFiles.length > 0 || additionalText.trim();
  const totalFileSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);

  return (
    <div className="space-y-6">
      {/* Main Grid: Info left (1/3), Upload fields right (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Info Banner (1/3) */}
        <Card className="border-primary/20 bg-primary/5 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-primary">Lead Eingabe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium">Zur Unterstützung bei der Bid/No-Bid Entscheidung:</p>
            <p>
              Die AI-Analyse extrahiert automatisch folgende Informationen aus den hochgeladenen
              Dokumenten:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs">
              <li>
                <strong>Budget & Laufzeit:</strong> Budgetangaben und Vertragslaufzeit werden
                identifiziert
              </li>
              <li>
                <strong>Ausschreibungszeitplan:</strong> Timeline, Fristen und Vergabeverfahren
                (Shortlisting vs. offenes Verfahren) werden analysiert
              </li>
              <li>
                <strong>Vertragstyp:</strong> Vertragsbedingungen (EVB-IT, Werk-, Dienst- oder
                Servicevertrag mit SLA) werden erkannt
              </li>
              <li>
                <strong>Leistungsumfang:</strong> Geforderte Leistungen werden strukturiert
                aufbereitet
              </li>
              <li>
                <strong>Referenzanforderungen:</strong> Anzahl und Spezifikation der geforderten
                Referenzen (inkl. Branchenvorgaben) werden erfasst
              </li>
              <li>
                <strong>Zuschlagskriterien:</strong> Bewertungskriterien für Teilnahmeantrag und
                Angebot werden differenziert dargestellt
              </li>
              <li>
                <strong>Angebotsstruktur:</strong> Erforderliche Arbeitspakete für Teilnahme- und
                Angebotsphase werden identifiziert
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* RIGHT: Upload Fields stacked vertically (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* File Upload */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Dokumente hochladen
                  </CardTitle>
                  <CardDescription>
                    PDF, Excel, Word - Pre-Qualification, Anhänge, E-Mails
                  </CardDescription>
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
                  id="file-upload"
                  accept=".pdf,.xls,.xlsx,.doc,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />

                <label htmlFor="file-upload" className="cursor-pointer block">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    {selectedFiles.length > 0
                      ? 'Weitere Dateien hinzufügen'
                      : 'Dateien hierher ziehen'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Excel, Word - oder klicken (max. 10 MB/Datei)
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
                placeholder="Kopieren Sie hier den Pre-Qualification-Text oder E-Mail-Inhalt ein..."
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
              {hasAnyInput && (
                <div className="space-y-1">
                  <span className="text-green-600 font-medium">✓ Eingaben vorhanden:</span>
                  <div className="text-muted-foreground text-xs flex gap-2">
                    {selectedFiles.length > 0 && (
                      <span>
                        {selectedFiles.length} Datei{selectedFiles.length > 1 ? 'en' : ''}
                      </span>
                    )}
                    {additionalText.trim() && <span>+ Text</span>}
                  </div>
                </div>
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
                  Lead erstellen
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
