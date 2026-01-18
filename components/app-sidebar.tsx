"use client"

import * as React from "react"
import {
  BarChart3,
  Building2,
  FileText,
  Home,
  PlusCircle,
  Settings,
  Target,
  Users,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string
    email: string
    role: 'bd' | 'bl' | 'admin'
    avatar: string
  }
}

// Dealhunter navigation data
const teams = [
  {
    name: "adesso SE",
    logo: Building2,
    plan: "Enterprise",
  },
]

type UserRole = 'bd' | 'bl' | 'admin'

const allNavItems: Array<{
  title: string
  url: string
  icon: typeof Home
  isActive?: boolean
  roles: UserRole[]
  items?: Array<{ title: string; url: string }>
}> = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    isActive: true,
    roles: ['bd', 'bl', 'admin'],
  },
  {
    title: "Bids",
    url: "/bids",
    icon: FileText,
    roles: ['bd', 'bl', 'admin'],
    items: [
      {
        title: "All Bids",
        url: "/bids",
      },
      {
        title: "New Bid",
        url: "/bids/new",
      },
      {
        title: "Pending Review",
        url: "/bids?status=pending",
      },
      {
        title: "Approved",
        url: "/bids?status=approved",
      },
    ],
  },
  {
    title: "Accounts",
    url: "/accounts",
    icon: Target,
    roles: ['bd', 'bl', 'admin'],
    items: [
      {
        title: "All Accounts",
        url: "/accounts",
      },
      {
        title: "Active",
        url: "/accounts?status=active",
      },
      {
        title: "Pipeline",
        url: "/accounts?status=pipeline",
      },
    ],
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    roles: ['bd', 'bl', 'admin'],
  },
  {
    title: "Admin",
    url: "/admin",
    icon: Settings,
    roles: ['admin'],
    items: [
      {
        title: "Validierung",
        url: "/admin/validations",
      },
      {
        title: "Business Unit",
        url: "/admin/business-lines",
      },
      {
        title: "Technologies",
        url: "/admin/technologies",
      },
      {
        title: "Employees",
        url: "/admin/employees",
      },
    ],
  },
]

const allProjects: Array<{
  name: string
  url: string
  icon: typeof PlusCircle
  roles: UserRole[]
}> = [
  {
    name: "Quick Actions",
    url: "/bids/new",
    icon: PlusCircle,
    roles: ['bd', 'bl', 'admin'],
  },
  {
    name: "Employees",
    url: "/admin/employees",
    icon: Users,
    roles: ['admin'],
  },
]

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  // Filter navigation items based on user role
  const navMain = allNavItems.filter(item => item.roles.includes(user.role))
  const projects = allProjects.filter(project => project.roles.includes(user.role))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavProjects projects={projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
