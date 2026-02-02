'use client';

interface LeadLayoutClientProps {
  children: React.ReactNode;
  leadId: string;
}

export function LeadLayoutClient({ children }: LeadLayoutClientProps) {
  return <>{children}</>;
}
