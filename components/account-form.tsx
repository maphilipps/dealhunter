'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAccount } from '@/lib/accounts-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function AccountForm() {
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    const name = formData.get('name') as string;
    const industry = formData.get('industry') as string;
    const website = formData.get('website') as string;
    const notes = formData.get('notes') as string;

    if (!name || !industry) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    const result = await createAccount({
      name,
      industry,
      website,
      notes,
    });

    if (result.success) {
      toast.success('Account erfolgreich erstellt');
      router.push('/accounts');
    } else {
      toast.error(result.error || 'Fehler beim Erstellen');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neuer Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Kundenname *</Label>
            <Input id="name" name="name" required placeholder="z.B. ACME Corporation" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Branche *</Label>
            <Input id="industry" name="industry" required placeholder="z.B. Automotive, Finance, Healthcare" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website (optional)</Label>
            <Input id="website" name="website" type="url" placeholder="z.B. https://www.example.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen (optional)</Label>
            <textarea
              id="notes"
              name="notes"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              rows={4}
              placeholder="Zusätzliche Informationen über den Kunden..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Abbrechen
            </Button>
            <Button type="submit">Speichern</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
