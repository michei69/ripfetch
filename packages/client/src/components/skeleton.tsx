import { cn } from "../lib/utils";

export function Skeleton(props: { class?: string }) {
  return <div class={cn("skeleton", props.class)} />;
}

/**
 * Mirrors the real game page: banner, title block, fact table, then the
 * downloads table, so the layout does not jump when the stream resolves.
 */
export function GamePageSkeleton() {
  return (
    <div aria-hidden="true">
      <div class="hero">
        <Skeleton class="hero-banner" />

        <div>
          <Skeleton class="h-4 w-full" />
          <Skeleton class="mt-2 h-4 w-2/3" />
        </div>

        <div class="facts">
          <Skeleton class="h-8 w-full" />
          <Skeleton class="mt-1 h-8 w-full" />
          <Skeleton class="mt-1 h-8 w-full" />
          <Skeleton class="mt-1 h-8 w-full" />
        </div>
      </div>

      <div class="mt-14">
        <div class="sec-head">
          <Skeleton class="h-6 w-40" />
          <Skeleton class="h-3.5 w-32" />
        </div>
        <Skeleton class="mt-4 h-1 w-full" />
        <div class="mt-6">
          <Skeleton class="h-3.5 w-32" />
          <Skeleton class="mt-3 h-11 w-full" />
          <Skeleton class="mt-1 h-11 w-full" />
          <Skeleton class="mt-1 h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
