'use client';

import { Trash2, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteEmployee } from '@/lib/admin/employees-actions';

interface Employee {
  id: string;
  name: string;
  email: string;
  skills: string;
  roles: string;
  availabilityStatus: string;
  createdAt: Date | null;
  businessUnitId: string;
  businessLineName: string | null;
}

export function EmployeeList({ employees }: { employees: Employee[] | undefined }) {
  const router = useRouter();

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Möchten Sie "${name}" wirklich löschen?`)) return;
    try {
      const result = await deleteEmployee(id);
      if (result.success) {
        toast.success('Mitarbeiter erfolgreich gelöscht');
        window.location.reload();
      } else {
        toast.error(result.error || 'Fehler beim Löschen');
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    }
  };

  if (!employees || employees.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Noch keine Mitarbeiter erfasst</p>
        <a href="/admin/employees/new" className="text-primary hover:underline">
          Ersten Mitarbeiter erstellen →
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {employees.map(emp => {
        const skills = JSON.parse(emp.skills || '[]');
        const roles = JSON.parse(emp.roles || '[]');

        return (
          <Card key={emp.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">{emp.name}</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/admin/employees/${emp.id}`)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id, emp.name)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">E-Mail:</span>
                <p className="font-medium">{emp.email}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Business Unit:</span>
                <p className="font-medium">{emp.businessLineName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Skills:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {skills.map((skill: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Rollen:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {roles.map((role: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Verfügbarkeit:</span>
                <Badge variant={emp.availabilityStatus === 'available' ? 'default' : 'secondary'}>
                  {emp.availabilityStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
