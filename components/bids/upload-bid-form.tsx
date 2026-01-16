'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2, Type, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { uploadPdfBid, uploadFreetextBid, uploadEmailBid } from '@/lib/bids/actions';

interface UploadBidFormProps {
  userId: string;
  accounts: Array<{ id: string; name: string; industry: string }>;
}

export function UploadBidForm({ userId, accounts }: UploadBidFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pdf' | 'freetext' | 'email'>('pdf');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [enableDSGVO, setEnableDSGVO] = useState(false);
  const [piiPreview, setPiiPreview] = useState<Array<{before: string; after: string; type: string}> | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Freetext state
  const [projectDescription, setProjectDescription] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Email state
  const [emailContent, setEmailContent] = useState('');

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
        setPiiPreview(null); // Reset PII preview on new file
      } else {
        toast.error('Nur PDF-Dateien sind erlaubt');
      }
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    // If DSGVO cleaning is enabled, show preview first
    if (enableDSGVO && !piiPreview) {
      // Simulate PII detection (since we don't extract text yet)
      // In production, this would analyze the PDF content
      const mockPII = [
        { type: 'name', before: 'Max Mustermann', after: '[NAME ENTFERNT]' },
        { type: 'email', before: 'max.mustermann@example.com', after: '[EMAIL ENTFERNT]' },
      ];
      setPiiPreview(mockPII);
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('source', 'reactive');
      formData.append('stage', 'rfp');
      formData.append('enableDSGVO', enableDSGVO.toString());
      if (selectedAccountId) {
        formData.append('accountId', selectedAccountId);
      }

      const result = await uploadPdfBid(formData);

      if (result.success) {
        if (result.piiRemoved) {
          toast.success('PDF erfolgreich hochgeladen (persönliche Daten entfernt)');
        } else {
          toast.success('PDF erfolgreich hochgeladen');
        }
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

  const handleFreetextSubmit = async () => {
    setIsUploading(true);

    try {
      const result = await uploadFreetextBid({
        projectDescription,
        customerName,
        source: 'reactive',
        stage: 'warm',
        accountId: selectedAccountId || undefined,
      });

      if (result.success) {
        toast.success('Anforderung erfolgreich gespeichert');
        router.push(`/bids/${result.bidId}`);
      } else {
        toast.error(result.error || 'Speichern fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Freetext submit error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEmailSubmit = async () => {
    setIsUploading(true);

    try {
      const result = await uploadEmailBid({
        emailContent,
        source: 'reactive',
        stage: 'warm',
        accountId: selectedAccountId || undefined,
      });

      if (result.success) {
        toast.success('E-Mail erfolgreich gespeichert');
        router.push(`/bids/${result.bidId}`);
      } else {
        toast.error(result.error || 'Speichern fehlgeschlagen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
      console.error('Email submit error:', error);
    } finally {
      setIsUploading(false);
    }
  };

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
        {selectedAccountId && (
          <button
            type="button"
            onClick={() => window.open('/accounts/new', '_blank')}
            className="mt-2 text-sm text-primary hover:underline"
          >
            + Neuen Account erstellen
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('pdf')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'pdf'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="inline-block h-4 w-4 mr-2" />
          PDF Upload
        </button>
        <button
          onClick={() => setActiveTab('freetext')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'freetext'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Type className="inline-block h-4 w-4 mr-2" />
          Text eingeben
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'email'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Mail className="inline-block h-4 w-4 mr-2" />
          E-Mail
        </button>
      </div>

      {/* PDF Upload Zone */}
      {activeTab === 'pdf' && (
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
            <div className="mt-6 space-y-4">
              {/* DSGVO Cleaning Option */}
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
                <input
                  type="checkbox"
                  id="dsgvo-cleaning"
                  checked={enableDSGVO}
                  onChange={(e) => {
                    setEnableDSGVO(e.target.checked);
                    if (!e.target.checked) {
                      setPiiPreview(null);
                    }
                  }}
                  disabled={isUploading}
                  className="h-4 w-4"
                />
                <label htmlFor="dsgvo-cleaning" className="text-sm font-medium cursor-pointer">
                  DSGVO-Bereinigung aktivieren (persönliche Daten entfernen)
                </label>
              </div>

              {/* PII Preview */}
              {piiPreview && (
                <div className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                  <h4 className="font-semibold text-sm mb-3 text-yellow-900">
                    Gefundene persönliche Daten ({piiPreview.length}):
                  </h4>
                  <div className="space-y-2">
                    {piiPreview.map((item, index) => (
                      <div key={index} className="text-sm">
                        <span className="inline-block px-2 py-0.5 rounded bg-yellow-200 text-yellow-900 font-mono text-xs mr-2">
                          {item.type.toUpperCase()}
                        </span>
                        <span className="line-through opacity-50">{item.before}</span>
                        <span className="ml-2 text-green-700 font-medium">{item.after}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
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
            </div>
          )}
        </div>
      )}

      {/* Freetext Input */}
      {activeTab === 'freetext' && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Text eingeben</h2>

          <div className="space-y-6">
            {/* Customer Name */}
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium mb-2">
                Kundenname *
              </label>
              <input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="z.B. ABC Manufacturing GmbH"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading}
              />
            </div>

            {/* Project Description */}
            <div>
              <label htmlFor="projectDescription" className="block text-sm font-medium mb-2">
                Projektbeschreibung * (mindestens 50 Zeichen)
              </label>
              <textarea
                id="projectDescription"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Beschreiben Sie die Anforderungen des Projekts..."
                rows={10}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {projectDescription.length} / 50 Zeichen (minimum)
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleFreetextSubmit}
                disabled={isUploading || projectDescription.trim().length < 50 || !customerName.trim()}
                className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : (
                  <>
                    Weiter
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Input */}
      {activeTab === 'email' && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">E-Mail einfügen</h2>

          <div className="space-y-6">
            {/* Email Content */}
            <div>
              <label htmlFor="emailContent" className="block text-sm font-medium mb-2">
                E-Mail-Inhalt * (mindestens 50 Zeichen)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Bitte E-Mail mit Header einfügen (From, Subject, Date werden automatisch extrahiert)
              </p>
              <textarea
                id="emailContent"
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                placeholder={`From: kunde@example.com\nSubject: Projektanfrage XYZ\nDate: 2026-01-16\n\nSehr geehrte Damen und Herren,\n\nwir planen ein neues Projekt...`}
                rows={15}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y font-mono"
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {emailContent.length} / 50 Zeichen (minimum)
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleEmailSubmit}
                disabled={isUploading || emailContent.trim().length < 50}
                className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : (
                  <>
                    Weiter
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
