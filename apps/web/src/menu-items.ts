import { MenuItem } from "@/types";

/**
 * Production navigation: only destinations that exist. The member area is the
 * home, the catalog (tools and recipes), what changed, and the community
 * (meetings and roadmap). The admin group, superadmin only, starts with the
 * consoles of the club itself (members, metrics, catalog, roadmap, meetings,
 * leads), then money and the platform's plumbing.
 */
export const leftMenuItems: MenuItem[] = [
  {
    id: "inicio",
    icon: "NiHome",
    label: "menu-inicio",
    description: "menu-inicio-description",
    color: "text-primary",
    href: "/inicio",
  },
  {
    id: "modulos",
    icon: "NiCatalog",
    label: "menu-modulos",
    description: "menu-modulos-description",
    color: "text-primary",
    href: "/modulos",
  },
  {
    id: "receitas",
    icon: "NiListSquare",
    label: "menu-receitas",
    description: "menu-receitas-description",
    color: "text-primary",
    href: "/receitas",
  },
  {
    id: "novidades",
    icon: "NiBell",
    label: "menu-novidades",
    description: "menu-novidades-description",
    color: "text-primary",
    href: "/novidades",
  },
  {
    id: "encontros",
    icon: "NiCalendar",
    label: "menu-encontros",
    description: "menu-encontros-description",
    color: "text-primary",
    href: "/encontros",
  },
  {
    id: "roadmap",
    icon: "NiFlag",
    label: "menu-roadmap",
    description: "menu-roadmap-description",
    color: "text-primary",
    href: "/roadmap",
  },
  {
    id: "admin",
    icon: "NiCrown",
    label: "menu-admin",
    description: "menu-admin-description",
    color: "text-primary",
    href: "/admin",
    superadminOnly: true,
    children: [
      {
        id: "admin-overview",
        icon: "NiDashboard",
        label: "menu-admin-overview",
        href: "/admin",
        description: "menu-admin-overview-description",
      },
      {
        id: "admin-members",
        icon: "NiUsers",
        label: "menu-admin-members",
        href: "/admin/membros",
        description: "menu-admin-members-description",
      },
      {
        id: "admin-metrics",
        icon: "NiChartLine",
        label: "menu-admin-metrics",
        href: "/admin/metricas",
        description: "menu-admin-metrics-description",
      },
      {
        id: "admin-catalog",
        icon: "NiCatalog",
        label: "menu-admin-catalog",
        href: "/admin/catalogo",
        description: "menu-admin-catalog-description",
      },
      {
        id: "admin-roadmap",
        icon: "NiFlag",
        label: "menu-admin-roadmap",
        href: "/admin/roadmap",
        description: "menu-admin-roadmap-description",
      },
      {
        id: "admin-meetings",
        icon: "NiCalendar",
        label: "menu-admin-meetings",
        href: "/admin/encontros",
        description: "menu-admin-meetings-description",
      },
      {
        id: "admin-leads",
        icon: "NiEmail",
        label: "menu-admin-leads",
        href: "/admin/leads",
        description: "menu-admin-leads-description",
      },
      {
        id: "admin-billing",
        icon: "NiMoney",
        label: "menu-admin-billing",
        href: "/admin/billing",
        description: "menu-admin-billing-description",
      },
      {
        id: "admin-ai",
        icon: "NiAI",
        label: "menu-admin-ai",
        href: "/admin/ai",
        description: "menu-admin-ai-description",
      },
      {
        id: "admin-audit",
        icon: "NiShieldCheck",
        label: "menu-admin-audit",
        href: "/admin/audit",
        description: "menu-admin-audit-description",
      },
      {
        id: "admin-insights",
        icon: "NiChartLineBar",
        label: "menu-admin-insights",
        href: "/admin/insights",
        description: "menu-admin-insights-description",
      },
      {
        id: "admin-backups",
        icon: "NiArchive",
        label: "menu-admin-backups",
        href: "/admin/backups",
        description: "menu-admin-backups-description",
      },
      {
        id: "admin-announcements",
        icon: "NiAnnouncement",
        label: "menu-admin-announcements",
        href: "/admin/announcements",
        description: "menu-admin-announcements-description",
      },
      {
        id: "admin-help",
        icon: "NiQuestionHexagon",
        label: "menu-admin-help",
        href: "/admin/help",
        description: "menu-admin-help-description",
      },
      {
        id: "admin-blog",
        icon: "NiPen",
        label: "menu-admin-blog",
        href: "/admin/blog",
        description: "menu-admin-blog-description",
      },
      {
        id: "admin-support",
        icon: "NiHeadset",
        label: "menu-admin-support",
        href: "/admin/support",
        description: "menu-admin-support-description",
      },
    ],
  },
];

export const leftMenuBottomItems: MenuItem[] = [
  { id: "settings", label: "menu-settings", href: "/settings", icon: "NiSettings" },
];
