'use client';

import PageError from '@/components/page-error';

export default function RfpDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageError
      error={error}
      resetAction={reset}
      fallbackMessage="Qualification konnte nicht geladen werden"
    />
  );
}
