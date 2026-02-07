'use client';

import PageError from '@/components/page-error';

export default function PitchesError({
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
      fallbackMessage="Pitches konnten nicht geladen werden"
    />
  );
}
