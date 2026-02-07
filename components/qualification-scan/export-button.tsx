'use client';

import { useState } from 'react';
import { Download, FileText, File } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportButtonProps {
  qualificationId: string;
}

export function ExportButton({ qualificationId }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function downloadFile(url: string, filename: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Export fehlgeschlagen');

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  async function handleExport(format: 'docx' | 'pdf' | 'md') {
    setIsExporting(true);
    const toastId = toast.loading('Exportiere…');
    try {
      const url = `/api/qualifications/${qualificationId}/qualification-scan/export?format=${format}`;

      if (format === 'pdf') {
        // Open printable HTML in new tab — user prints to PDF
        window.open(url, '_blank');
        toast.success('Druckansicht geöffnet', { id: toastId });
      } else {
        const filename =
          format === 'docx'
            ? `qualification-scan-${qualificationId}.docx`
            : `qualification-scan-${qualificationId}.md`;
        await downloadFile(url, filename);
        toast.success('Export heruntergeladen', { id: toastId });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Fehler beim Export', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exportiere…' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('docx')}>
          <FileText className="mr-2 h-4 w-4" />
          Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('md')}>
          <FileText className="mr-2 h-4 w-4" />
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <File className="mr-2 h-4 w-4" />
          PDF (Druckansicht)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
