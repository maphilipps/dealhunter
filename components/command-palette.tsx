'use client';

import { Database, FileText, ListChecks, ListTodo, Plus, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';

interface CommandPaletteItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

const navigationItems: CommandPaletteItem[] = [
  {
    label: 'Leads',
    href: '/pre-qualifications',
    icon: ListTodo,
    shortcut: 'G L',
  },
  {
    label: 'Pitches',
    href: '/pitches',
    icon: ListChecks,
  },
  {
    label: 'Referenzen',
    href: '/master-data/references',
    icon: Database,
  },
  {
    label: 'Kompetenzen',
    href: '/master-data/competencies',
    icon: Database,
  },
  {
    label: 'Wettbewerber',
    href: '/master-data/competitors',
    icon: Database,
  },
];

const adminItems: CommandPaletteItem[] = [
  {
    label: 'Business Units',
    href: '/admin/business-units',
    icon: Database,
  },
  {
    label: 'Technologies',
    href: '/master-data/technologies',
    icon: Database,
  },
  {
    label: 'Employees',
    href: '/admin/employees',
    icon: Database,
  },
  {
    label: 'Konfiguration',
    href: '/admin/configs',
    icon: Settings,
  },
];

const actionItems: CommandPaletteItem[] = [
  {
    label: 'Neue Pre-Qualification erstellen',
    href: '/pre-qualifications/new',
    icon: Plus,
    shortcut: 'N',
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: FileText,
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Suche nach Seiten, Aktionen und Einstellungen..."
    >
      <CommandInput placeholder="Suche..." />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navigationItems.map(item => (
            <CommandItem key={item.href} onSelect={() => runCommand(item.href)}>
              <item.icon className="mr-2 size-4" />
              {item.label}
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Aktionen">
          {actionItems.map(item => (
            <CommandItem key={item.href} onSelect={() => runCommand(item.href)}>
              <item.icon className="mr-2 size-4" />
              {item.label}
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Administration">
          {adminItems.map(item => (
            <CommandItem key={item.href} onSelect={() => runCommand(item.href)}>
              <item.icon className="mr-2 size-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
