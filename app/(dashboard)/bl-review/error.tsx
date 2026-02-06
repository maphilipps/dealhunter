'use client';

import PageError from '@/components/page-error';

export default function BlReviewError({
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
      fallbackMessage="BL Review konnte nicht geladen werden"
    />
  );
}
