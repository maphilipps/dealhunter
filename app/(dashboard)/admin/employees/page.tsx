'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getEmployees, importEmployeesFromCSV } from '@/lib/admin/employees-actions';
import { EmployeeList } from '@/components/admin/employee-list';
import { Button } from '@/components/ui/button';
import { Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function EmployeesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      const result = await getEmployees();
      if (result.success) {
        setEmployees(result.employees || []);
      }
      setIsLoading(false);
    }
    loadData();
  }, []);

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvData = event.target?.result as string;
      setIsImporting(true);

      try {
        const result = await importEmployeesFromCSV(csvData);
        if (result.success) {
          toast.success(`${result.imported} Mitarbeiter erfolgreich importiert`);
          if (result.errors) {
            toast.warning(`Fehler bei ${result.errors.length} Einträgen`);
            console.error('Import errors:', result.errors);
          }
          setIsDialogOpen(false);
          window.location.reload();
        } else {
          toast.error(result.error || 'Fehler beim Import');
        }
      } catch (error) {
        toast.error('Ein Fehler ist aufgetreten');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  if (isLoading) {
    return <div className="p-8">Lade...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Mitarbeiter</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Mitarbeiter, Skills und Verfügbarkeiten
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  CSV Import
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mitarbeiter aus CSV importieren</DialogTitle>
                  <DialogDescription>
                    Laden Sie eine CSV-Datei mit folgendem Format hoch:
                    <br />
                    <code className="text-xs bg-muted p-2 rounded block mt-2">
                      name,email,businessUnitId,skills,roles,availabilityStatus
                      <br />
                      Max Mustermann,max@example.com,bu-id-123,React;TypeScript,developer;lead,available
                    </code>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      Skills und Rollen mit Semikolon (;) trennen
                    </span>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    disabled={isImporting}
                    className="w-full"
                  />
                  {isImporting && (
                    <p className="text-sm text-muted-foreground">Importiere...</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={() => router.push('/admin/employees/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Neuer Mitarbeiter
            </Button>
          </div>
        </div>

        <EmployeeList employees={employees} />
      </div>
    </div>
  );
}
