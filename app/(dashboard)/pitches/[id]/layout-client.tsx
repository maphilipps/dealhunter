'use client';

interface LeadLayoutClientProps {
  children: React.ReactNode;
  leadId: string;
  /** Pre-resolved from server: ID of an active (non-terminal) run, or null */
  activeRunId: string | null;
}

export function LeadLayoutClient({ children }: LeadLayoutClientProps) {
  return <div className="h-full w-full">{children}</div>;
}
