'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { DynamicBreadcrumb } from '@/components/dynamic-breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

interface SidebarWrapperProps {
  user: {
    name: string;
    email: string;
    role: 'bd' | 'bl' | 'admin';
    avatar: string;
  };
  children: React.ReactNode;
}

/**
 * Client-side wrapper for Sidebar to prevent Radix UI hydration mismatch.
 * Radix UI generates unique IDs that differ between server and client renders.
 * By making this a client component, the IDs are only generated on the client.
 */
export function SidebarWrapper({ user, children }: SidebarWrapperProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <DynamicBreadcrumb />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
