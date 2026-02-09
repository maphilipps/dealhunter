export type PdfChunkSource = {
  kind: 'pdf';
  fileName: string;
  pass?: 'text' | 'tables' | 'images';
  page: number;
  paragraphStart: number;
  paragraphEnd: number;
  heading: string | null;
};

export type ChunkSource = PdfChunkSource;

export function formatSourceCitation(source: ChunkSource): string {
  if (source.kind === 'pdf') {
    const para =
      source.paragraphStart === source.paragraphEnd
        ? `Absatz ${source.paragraphStart}`
        : `Absatz ${source.paragraphStart}-${source.paragraphEnd}`;
    const heading = source.heading ? `, "${source.heading}"` : '';
    const pass =
      source.pass && source.pass !== 'text'
        ? source.pass === 'tables'
          ? ', Tabellen'
          : ', Bilder (OCR)'
        : '';
    return `${source.fileName}, Seite ${source.page}, ${para}${heading}${pass}`;
  }

  // Future-proof default (should be unreachable while ChunkSource is only PDF)
  return '';
}
