'use client';

import PageError from '@/components/page-error';

export default function QualificationsError({
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
      fallbackMessage="Qualifications konnten nicht geladen werden"
    />
  );
}
