'use client';

import PageError from '@/components/page-error';

export default function PitchDetailError({
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
      fallbackMessage="Pitch konnte nicht geladen werden"
    />
  );
}
