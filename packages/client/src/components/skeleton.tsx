import { cn } from "../lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-muted/60 skeleton-shimmer", className)} />;
}

export function GamePageSkeleton() {
  return (
    <div className="game-page">
      <div className="game-overview">
        {/* terminal title bar strip */}
        <div className="flex items-center gap-2 pb-3 mb-5 border-b border-border">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3.5 w-40 ml-2" />
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-72 shrink-0">
            <Skeleton className="w-full aspect-video md:aspect-auto md:h-40" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex flex-wrap gap-2 pt-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
            {/* meta rows */}
            <div className="space-y-2 pt-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        </div>
      </div>

      <div className="download-workspace">
        <div className="download-results">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-2.5 w-32 md:w-48" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
        <aside className="activity-panel">
          <div className="section-heading">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-5 w-10" />
          </div>
          <Skeleton className="h-2 w-full" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </aside>
      </div>
    </div>
  );
}
