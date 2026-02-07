'use client';

import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const routeLabels: Record<string, string> = {
  bids: 'Leads',
  qualifications: 'Leads',
  pitches: 'Pitches',
  new: 'Neu',
  accounts: 'Accounts',
  analytics: 'Analytics',
  admin: 'Admin',
  users: 'Users',
  teams: 'Teams',
  settings: 'Einstellungen',
  'bl-review': 'BL-Review',
  references: 'Referenzen',
  competencies: 'Kompetenzen',
  competitors: 'Wettbewerber',
  'master-data': 'Stammdaten',
  technologies: 'Technologien',
  employees: 'Mitarbeiter',
  'business-units': 'Business Units',
  interview: 'Interview',
  estimation: 'Schätzung',
  staffing: 'Staffing',
  'website-audit': 'Website Audit',
  'pitch-scan': 'Pitch Scan',
  'qualification-scan': 'Qualification Scan',
  audit: 'Audit',
  dashboard: 'Dashboard',
};

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Leads</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const path = '/' + segments.slice(0, index + 1).join('/');
          const isLast = index === segments.length - 1;
          const isFirst = index === 0;
          const label = routeLabels[segment] || segment;
          // Show first and last breadcrumb on mobile, hide middle ones
          const hiddenOnMobile = !isFirst && !isLast ? 'hidden md:block' : '';

          return (
            <Fragment key={path}>
              {!isFirst && <BreadcrumbSeparator className={hiddenOnMobile} />}
              <BreadcrumbItem className={hiddenOnMobile}>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={path}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
