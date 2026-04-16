/**
 * CopyButton — clipboard button with real feedback.
 *
 * The previous InvitePage Copy button fired `navigator.clipboard.writeText`
 * and returned — no toast, no icon swap, no button-state change. Users
 * clicked and nothing visibly happened.
 *
 * This primitive flips to a "Copied" state for 1.6s after a successful
 * copy. Pair with `<ProgressBar>` and `<Button>` for full feedback.
 */
import { Check, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from './Button';

interface CopyButtonProps {
  readonly value: string;
  readonly labelIdle?: string;
  readonly labelCopied?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  readonly className?: string;
}

export function CopyButton({
  value,
  labelIdle = 'Copy',
  labelCopied = 'Copied',
  size = 'md',
  variant = 'primary',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  }, [value]);

  return (
    <Button
      onClick={handleCopy}
      size={size}
      variant={variant}
      className={className}
      leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
    >
      {copied ? labelCopied : labelIdle}
    </Button>
  );
}
