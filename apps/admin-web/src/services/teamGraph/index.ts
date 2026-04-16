/**
 * TeamGraph service entry. Pages import only from here.
 *
 * Future backend switch:
 *   1. Implement `backendProvider.ts` against /admin/network/overview.
 *   2. Replace the `teamGraphProvider` export below.
 *
 * Nothing else in the app needs to change.
 */
import { useQuery } from '@tanstack/react-query';

import { aggregateTeamGraphProvider } from './aggregateProvider';
import { computeAncestors, computeDirectChildren } from './graphBuilder';
import type { TeamGraphProvider, TeamGraphSnapshot } from './types';

export const teamGraphProvider: TeamGraphProvider = aggregateTeamGraphProvider;

export function useTeamGraph() {
  return useQuery<TeamGraphSnapshot>({
    queryKey: ['admin', 'team-graph'],
    queryFn: () => teamGraphProvider.getSnapshot(),
    staleTime: 60_000,
  });
}

export { computeAncestors, computeDirectChildren };
export type {
  DepthBucket,
  TeamGraphKpis,
  TeamGraphNode,
  TeamGraphSnapshot,
} from './types';
