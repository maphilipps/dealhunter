'use client';

import {
  LeadScanRenderer,
  type RenderTree,
} from '@/components/json-render/qualification-scan-registry';

interface SectionRendererClientProps {
  tree: Record<string, unknown>;
}

export function SectionRendererClient({ tree }: SectionRendererClientProps) {
  return <LeadScanRenderer tree={tree as unknown as RenderTree} />;
}
