'use client';
import type { ReactNode } from 'react';
import { Button, ButtonLink } from './Button';
import { Panel } from './Panel';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`k7-skeleton ${className}`} />;
}

export function PanelSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <Panel className={`p-5 ${className}`} aria-busy="true" aria-live="polite">
      <Skeleton className="mb-3 h-7 w-2/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`mb-2 h-4 ${i % 2 ? 'w-5/6' : 'w-full'}`} />
      ))}
    </Panel>
  );
}

export function EmptyState({
  title,
  text,
  action,
  className = '',
}: {
  title: string;
  text?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <Panel tone="mist" shadow="sm" className={`flex flex-col items-start gap-3 p-5 ${className}`}>
      <h3 className="font-display text-[28px] leading-none">{title}</h3>
      {text ? <p className="text-[14px] text-ink/80">{text}</p> : null}
      {action ? (
        action.href ? (
          <ButtonLink href={action.href} size="sm">
            {action.label}
          </ButtonLink>
        ) : (
          <Button size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </Panel>
  );
}

export function ErrorState({ message, onRetry, className = '' }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <Panel shadow="sm" className={`flex flex-col items-start gap-3 p-5 ${className}`} role="alert">
      <h3 className="font-display text-[28px] leading-none">Something went wrong</h3>
      <p className="text-[14px] text-ink/80">{message ?? 'Try again.'}</p>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          retry
        </Button>
      ) : null}
    </Panel>
  );
}

export function Section({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title ? <h2 className="k7-label mb-2 text-ink">{title}</h2> : null}
      {children}
    </section>
  );
}
