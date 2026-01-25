'use client';

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

interface AppLogoProps {
  name: string;
  logo: string;
  subtitle?: string;
}

export function AppLogo({ name, logo, subtitle }: AppLogoProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
          <div className="flex items-center justify-center" style={{ width: 70, height: 70 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt={`${name} logo`}
              width={70}
              height={70}
              className="shrink-0 object-contain"
              style={{ width: 70, height: 70 }}
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{name}</span>
            {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Legacy export for backwards compatibility
export const TeamSwitcher = AppLogo;
