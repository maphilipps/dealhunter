'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUsers, updateUserRole, deleteUser } from '@/lib/admin/users-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UsersPage() {
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      const result = await getUsers();

      if (!result.success) {
        router.push('/dashboard');
        return;
      }

      setAllUsers(result.users || []);
      setCurrentUserId(result.currentUserId || null);
      setIsLoading(false);
    }

    loadUsers();
  }, [router]);

  if (isLoading) {
    return <div className="p-8">Lade...</div>;
  }

  const handleRoleChange = async (userId: string, newRole: 'bd' | 'bl' | 'admin') => {
    const result = await updateUserRole(userId, newRole);
    if (result.success) {
      toast.success('Rolle erfolgreich aktualisiert');
      window.location.reload();
    } else {
      toast.error(result.error || 'Fehler beim Aktualisieren');
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`Möchten Sie "${name}" wirklich löschen?`)) return;
    const result = await deleteUser(userId);
    if (result.success) {
      toast.success('Benutzer erfolgreich gelöscht');
      window.location.reload();
    } else {
      toast.error(result.error || 'Fehler beim Löschen');
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Benutzerverwaltung</h1>
          <p className="text-muted-foreground">Verwalten Sie Benutzerkonten und Rollen</p>
        </div>

        {!allUsers || allUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Noch keine Benutzer vorhanden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allUsers.map(user => (
              <Card key={user.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">{user.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        user.role === 'admin'
                          ? 'default'
                          : user.role === 'bl'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {user.role.toUpperCase()}
                    </Badge>
                    {user.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user.id, user.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div>
                    <span className="text-muted-foreground">E-Mail:</span>
                    <p className="font-medium">{user.email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Erstellt am:</span>
                    <p className="font-medium">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString('de-DE')
                        : 'N/A'}
                    </p>
                  </div>
                  {user.id !== currentUserId && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Rolle ändern:</span>
                      <select
                        value={user.role}
                        onChange={e => handleRoleChange(user.id, e.target.value as any)}
                        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
                      >
                        <option value="bd">BD</option>
                        <option value="bl">BL</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
