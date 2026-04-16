/**
 * Minimum viable shared UI primitives for the user frontend.
 *
 * Before this: every page re-pasted `rounded-lg border border-slate-200
 * dark:border-slate-800 p-4` for cards, `bg-brand-600 text-white rounded
 * px-4 py-2` for buttons, and so on. Any brand change meant
 * grep-and-replace across every page.
 *
 * After this: pages compose `<Card>`, `<Button>`, `<Stat>`, `<InfoRow>`,
 * `<EmptyHint>`, `<CopyButton>`, `<ProgressBar>`, `<StatusPill>` and
 * the Tailwind drift stops.
 *
 * These are deliberately thin — no over-engineering, no prop explosion.
 * They exist to enforce consistency, not to be a full design system.
 */
export { Card, SectionCard } from './Card';
export { Button } from './Button';
export { Stat } from './Stat';
export { InfoRow } from './InfoRow';
export { EmptyHint } from './EmptyHint';
export { CopyButton } from './CopyButton';
export { ProgressBar } from './ProgressBar';
export { StatusPill } from './StatusPill';
export { RestrictedBanner } from './RestrictedBanner';
export { Skeleton, SkeletonGroup } from './Skeleton';
export { InlineError } from './InlineError';
