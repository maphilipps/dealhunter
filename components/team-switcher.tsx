'use client';

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

interface AppLogoProps {
  name?: string;
  logo?: string;
  subtitle?: string;
}

export function AppLogo({ name = 'PHP-XCOM', logo = '/logo.png', subtitle = 'DealHunter' }: AppLogoProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent h-auto py-2">
          <img src={logo} alt={`${name} logo`} className="h-12 w-auto object-contain" />
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold">{name}</span>
            <span className="text-xs text-sidebar-foreground/70">{subtitle}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Legacy export for backwards compatibility
export const TeamSwitcher = AppLogo;
