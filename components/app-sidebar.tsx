'use client';

import {
  Database,
  Home,
  ListTodo,
} from 'lucide-react';
import * as React from 'react';

import { NavMain } from '@/components/nav-main';
import { NavProjects } from '@/components/nav-projects';
import { NavUser } from '@/components/nav-user';
import { AppLogo } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string;
    email: string;
    role: 'bd' | 'bl' | 'admin';
    avatar: string;
  };
}

// PHPXOM Qualifier app branding
const appBranding = {
  name: 'PHPXOM',
  logo: '/logo.png',
  subtitle: 'Qualifier',
};

type UserRole = 'bd' | 'bl' | 'admin';

const allNavItems: Array<{
  title: string;
  url: string;
  icon: typeof Home;
  isActive?: boolean;
  roles: UserRole[];
  items?: Array<{ title: string; url: string }>;
}> = [
  {
    title: 'Dashboard',
    url: '/',
    icon: Home,
    isActive: true,
    roles: ['bd', 'bl', 'admin'],
  },
  {
    title: 'Qualifications',
    url: '/qualifications',
    icon: ListTodo,
    roles: ['bd', 'bl', 'admin'],
    items: [
      {
        title: 'Leads',
        url: '/pre-qualifications',
      },
      {
        title: 'Qualifications',
        url: '/qualifications',
      },
    ],
  },
];

const allMasterDataItems: Array<{
  name: string;
  url: string;
  icon: typeof Database;
  roles: UserRole[];
}> = [
  {
    name: 'Referenzen',
    url: '/master-data/references',
    icon: Database,
    roles: ['bd', 'bl', 'admin'],
  },
  {
    name: 'Kompetenzen',
    url: '/master-data/competencies',
    icon: Database,
    roles: ['bd', 'bl', 'admin'],
  },
  {
    name: 'Wettbewerber',
    url: '/master-data/competitors',
    icon: Database,
    roles: ['bd', 'bl', 'admin'],
  },
  {
    name: 'Business Units',
    url: '/admin/business-units',
    icon: Database,
    roles: ['bd', 'bl', 'admin'],
  },
  {
    name: 'Technologies',
    url: '/admin/technologies',
    icon: Database,
    roles: ['bd', 'bl', 'admin'],
  },
  {
    name: 'Employees',
    url: '/admin/employees',
    icon: Database,
    roles: ['bd', 'bl', 'admin'],
  },
];

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  // Filter navigation items based on user role
  const navMain = allNavItems.filter(item => item.roles.includes(user.role));
  const masterData = allMasterDataItems.filter(item => item.roles.includes(user.role));

  return (
    <Sidebar {...props} collapsible="icon">
      <SidebarHeader>
        <AppLogo {...appBranding} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavProjects projects={masterData} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      {props.collapsible !== 'none' && <SidebarRail />}
    </Sidebar>
  );
}
