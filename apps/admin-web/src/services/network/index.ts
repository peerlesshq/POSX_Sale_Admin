/**
 * Network service entry — the ONLY import point pages should use.
 *
 *   import { networkProvider, useNetworkOverview } from 'src/services/network';
 *
 * Switching to a real backend endpoint later is a one-line change in
 * this file (swap `aggregateNetworkProvider` for `backendNetworkProvider`).
 */
import { useQuery } from '@tanstack/react-query';

import { aggregateNetworkProvider } from './aggregateProvider';
import type {
  HierarchyAnalysis,
  NetworkDataProvider,
  NetworkLeader,
  NetworkOverview,
  UserNetworkSummary,
} from './types';

// Active provider — swap here once the backend endpoint ships.
export const networkProvider: NetworkDataProvider = aggregateNetworkProvider;

/* ---------------- React Query hooks ---------------- */

export function useNetworkOverview() {
  return useQuery<NetworkOverview>({
    queryKey: ['admin', 'network', 'overview'],
    queryFn: () => networkProvider.getNetworkOverview(),
    staleTime: 60_000,
  });
}

export function useHierarchyAnalysis() {
  return useQuery<HierarchyAnalysis>({
    queryKey: ['admin', 'network', 'hierarchy'],
    queryFn: () => networkProvider.getHierarchyAnalysis(),
    staleTime: 60_000,
  });
}

export function useTopLeaders(limit = 10) {
  return useQuery<readonly NetworkLeader[]>({
    queryKey: ['admin', 'network', 'top-leaders', limit],
    queryFn: () => networkProvider.getTopLeaders(limit),
    staleTime: 60_000,
  });
}

export function useUserNetwork(wallet: string) {
  return useQuery<UserNetworkSummary>({
    queryKey: ['admin', 'network', 'user', wallet],
    queryFn: () => networkProvider.getUserNetwork(wallet),
    enabled: wallet.length > 0,
    staleTime: 30_000,
  });
}

export type {
  HierarchyAnalysis,
  NetworkLeader,
  NetworkOverview,
  UserNetworkSummary,
  NetworkDataProvider,
} from './types';
