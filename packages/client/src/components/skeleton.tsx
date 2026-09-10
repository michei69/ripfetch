import { cn } from "../lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/**
 * Mirrors the real game page: banner, title block, fact table, then the
 * downloads table, so the layout does not jump when the stream resolves.
 */
export function GamePageSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="hero-banner" />

      <div className="hero-body">
        <div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>

        <div className="facts">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="mt-1 h-8 w-full" />
          <Skeleton className="mt-1 h-8 w-full" />
          <Skeleton className="mt-1 h-8 w-full" />
        </div>
      </div>

      <div className="mt-14">
        <div className="sec-head">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="mt-4 h-1 w-full" />
        <div className="mt-6">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="mt-3 h-11 w-full" />
          <Skeleton className="mt-1 h-11 w-full" />
          <Skeleton className="mt-1 h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
