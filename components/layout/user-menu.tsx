import { logout } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

interface UserMenuProps {
  user: {
    name: string;
    email: string;
    role: 'bd' | 'bl' | 'admin';
  };
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-sm">
        <div className="font-medium">{user.name}</div>
        <div className="text-muted-foreground text-xs">{user.email}</div>
      </div>
      <form action={logout}>
        <Button type="submit" variant="outline" size="sm">
          Logout
        </Button>
      </form>
    </div>
  );
}
