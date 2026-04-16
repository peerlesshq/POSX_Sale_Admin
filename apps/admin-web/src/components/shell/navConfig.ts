/**
 * Navigation configuration for the admin shell.
 *
 * Grouped sections. Rendered by `Sidebar.tsx`. Also consumed by
 * GlobalCommandPalette so typing a nav item in Ctrl+K takes you there.
 *
 * Each entry uses i18n keys for the display label so the sidebar stays
 * in-sync when the operator toggles language. Icons come from lucide.
 */
import {
  Activity,
  BarChart3,
  ClipboardList,
  Database,
  FileText,
  GitBranch,
  Gauge,
  Heart,
  Layers,
  Network,
  RefreshCcw,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface NavLink {
  readonly path: string;
  readonly labelKey: string;
  readonly icon?: LucideIcon;
  readonly children?: readonly NavLink[];
}

export interface NavSection {
  readonly titleKey: string;
  readonly links: readonly NavLink[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    titleKey: 'nav.section.overview',
    links: [
      { path: '/dashboard', labelKey: 'nav.dashboard', icon: Gauge },
    ],
  },
  {
    titleKey: 'nav.section.operations',
    links: [
      { path: '/users', labelKey: 'nav.users', icon: Users },
      {
        path: '/network',
        labelKey: 'nav.network',
        icon: Network,
        children: [
          { path: '/network', labelKey: 'nav.network.overview' },
          { path: '/network/team', labelKey: 'nav.network.team' },
          { path: '/network/hierarchy', labelKey: 'nav.network.hierarchy' },
        ],
      },
      {
        path: '/rewards',
        labelKey: 'nav.rewards',
        icon: Wallet,
        children: [
          { path: '/rewards', labelKey: 'nav.rewards.overview' },
          { path: '/rewards/direct', labelKey: 'nav.rewards.direct' },
          { path: '/rewards/team', labelKey: 'nav.rewards.team' },
          { path: '/rewards/equal-level', labelKey: 'nav.rewards.equal_level' },
          { path: '/rewards/burns', labelKey: 'nav.rewards.burns' },
        ],
      },
      { path: '/settlement/jobs', labelKey: 'nav.settlement', icon: Zap },
      { path: '/recompute', labelKey: 'nav.recompute', icon: RefreshCcw },
      { path: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
    ],
  },
  {
    titleKey: 'nav.section.system',
    links: [
      { path: '/config', labelKey: 'nav.config', icon: Settings },
      {
        path: '/system',
        labelKey: 'nav.system',
        icon: Database,
        children: [
          { path: '/system', labelKey: 'nav.system.overview' },
          { path: '/system/health', labelKey: 'nav.system.health' },
          { path: '/system/chain-sync', labelKey: 'nav.system.chain_sync' },
          { path: '/system/jobs', labelKey: 'nav.system.jobs' },
        ],
      },
      { path: '/logs', labelKey: 'nav.logs', icon: FileText },
    ],
  },
  {
    titleKey: 'nav.section.security',
    links: [
      { path: '/admin-accounts', labelKey: 'nav.admin_accounts', icon: ShieldCheck },
    ],
  },
];

/** Flatten all links for the command palette. */
export function flattenNav(): readonly {
  readonly path: string;
  readonly labelKey: string;
  readonly section: string;
  readonly icon?: LucideIcon;
}[] {
  const flat: {
    path: string;
    labelKey: string;
    section: string;
    icon?: LucideIcon;
  }[] = [];
  for (const section of NAV_SECTIONS) {
    for (const link of section.links) {
      flat.push({ path: link.path, labelKey: link.labelKey, section: section.titleKey, icon: link.icon });
      if (link.children) {
        for (const child of link.children) {
          flat.push({
            path: child.path,
            labelKey: child.labelKey,
            section: section.titleKey,
            icon: link.icon,
          });
        }
      }
    }
  }
  return flat;
}

/** Lookup table for breadcrumbs. */
const STATIC_BREADCRUMB_LABELS: Record<string, string> = {
  // Intermediate segments that are not full routes.
  '/settlement': 'nav.settlement',
  '/system': 'nav.system',
  '/users': 'nav.users',
  '/rewards': 'nav.rewards',
};

export function pathToLabelKey(path: string): string | undefined {
  for (const section of NAV_SECTIONS) {
    for (const link of section.links) {
      if (link.path === path) return link.labelKey;
      if (link.children) {
        for (const child of link.children) {
          if (child.path === path) return child.labelKey;
        }
      }
    }
  }
  // Dynamic user detail/tree segments — show "nav.users" for the wallet
  // crumb slot instead of leaking a raw hash.
  if (/^\/users\/0x[0-9a-f]+\/?(tree)?$/i.test(path)) {
    return path.endsWith('/tree') ? 'users.tree.title' : 'users.detail.title';
  }
  return STATIC_BREADCRUMB_LABELS[path];
}

/** Icons exported separately for misc use. */
export const NavIcons = {
  Users,
  Network,
  Wallet,
  Activity,
  Settings,
  FileText,
  ShieldCheck,
  Gauge,
  BarChart3,
  Heart,
  GitBranch,
  Layers,
  Database,
  ClipboardList,
  Zap,
  RefreshCcw,
  TrendingUp,
};
