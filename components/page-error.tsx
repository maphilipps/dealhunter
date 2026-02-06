'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PageError({
  error,
  resetAction,
  fallbackMessage,
}: {
  error: Error & { digest?: string };
  resetAction: () => void;
  fallbackMessage: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Fehler beim Laden</h1>

      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-600">Ein Fehler ist aufgetreten</CardTitle>
          </div>
          <CardDescription>{error.message || fallbackMessage}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={resetAction}>Erneut versuchen</Button>
        </CardContent>
      </Card>
    </div>
  );
}
