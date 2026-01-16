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

// Dealhunter navigation data
const data = {
  user: {
    name: "Max Mustermann",
    email: "max.mustermann@adesso.de",
    avatar: "/avatars/user.jpg",
  },
  teams: [
    {
      name: "adesso SE",
      logo: Building2,
      plan: "Enterprise",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: Home,
      isActive: true,
    },
    {
      title: "Bids",
      url: "/bids",
      icon: FileText,
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
    },
    {
      title: "Admin",
      url: "/admin",
      icon: Settings,
      items: [
        {
          title: "Users",
          url: "/admin/users",
        },
        {
          title: "Teams",
          url: "/admin/teams",
        },
        {
          title: "Settings",
          url: "/admin/settings",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Quick Actions",
      url: "/bids/new",
      icon: PlusCircle,
    },
    {
      name: "Team Overview",
      url: "/admin/teams",
      icon: Users,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
