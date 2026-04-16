/**
 * Shared claim-all flow hook.
 *
 * Previously the claim state machine lived inside RewardsPage.tsx and
 * the Dashboard's Claim All button had no onClick at all (UF-02 in the
 * audit). Extracting the flow lets both pages trigger the same code
 * path and keeps state transitions in one place.
 *
 * State machine:
 *   idle → preparing → signing → broadcasting → confirmed
 *                                            ↘ failed
 *
 * Each transition calls real APIs:
 *   1. preparing     — api.createClaim(...)
 *   2. signing       — signMessage(message_to_sign)
 *   3. broadcasting  — api.signClaim(orderId, signature)
 *   4. confirmed     — invalidateQueries(['rewards'], ['user','dashboard'])
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { api } from '../api/endpoints';
import { signMessage } from '../lib/wallet';

export type ClaimState =
  | 'idle'
  | 'preparing'
  | 'signing'
  | 'broadcasting'
  | 'confirmed'
  | 'failed';

export interface UseClaimAllInput {
  readonly wallet: string;
  readonly userStatus: string;
  readonly onSuccess?: () => void;
}

export interface UseClaimAllReturn {
  readonly state: ClaimState;
  readonly error: string | null;
  readonly orderId: string | null;
  readonly isBusy: boolean;
  readonly isBlocked: boolean;
  readonly run: () => Promise<void>;
  readonly reset: () => void;
}

const BLOCKED_STATUSES = new Set([
  'restricted_claim',
  'suspended',
  'blacklisted',
]);

export function useClaimAll({
  wallet,
  userStatus,
  onSuccess,
}: UseClaimAllInput): UseClaimAllReturn {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ClaimState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const isBlocked = BLOCKED_STATUSES.has(userStatus);
  const isBusy =
    state === 'preparing' || state === 'signing' || state === 'broadcasting';

  const createClaim = useMutation({
    mutationFn: () =>
      api.createClaim({
        client_request_id: `claim_${Date.now()}`,
        claim_scope: 'claim_all',
      }),
  });

  const signClaim = useMutation({
    mutationFn: (input: { claimOrderId: string; signature: string }) =>
      api.signClaim(input.claimOrderId, input.signature),
  });

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    setOrderId(null);
  }, []);

  const run = useCallback(async () => {
    if (isBlocked) {
      setError('claim_blocked');
      setState('failed');
      return;
    }
    setError(null);
    try {
      setState('preparing');
      const order = await createClaim.mutateAsync();
      const messageToSign = String(order['message_to_sign'] ?? '');
      const nextOrderId = String(order['claim_order_id'] ?? '');
      if (!messageToSign || !nextOrderId) {
        throw new Error('Invalid claim order response');
      }
      setOrderId(nextOrderId);

      setState('signing');
      const signature = await signMessage(messageToSign, wallet);

      setState('broadcasting');
      await signClaim.mutateAsync({ claimOrderId: nextOrderId, signature });

      setState('confirmed');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rewards'] }),
        queryClient.invalidateQueries({ queryKey: ['user', 'dashboard'] }),
      ]);
      onSuccess?.();
    } catch (err) {
      setState('failed');
      setError(err instanceof Error ? err.message : 'Claim failed');
    }
  }, [createClaim, signClaim, queryClient, wallet, isBlocked, onSuccess]);

  return { state, error, orderId, isBusy, isBlocked, run, reset };
}
