import { Skeleton } from "@/components/ui/skeleton";

export function MapPageSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="flex h-[calc(100dvh-var(--app-header)-var(--app-tabbar))] min-h-[480px] flex-col lg:flex-row"
    >
      <Skeleton className="flex-1 rounded-none" />
      <div className="h-[45%] space-y-4 border-t p-4 lg:h-auto lg:w-[440px] lg:border-t-0 lg:border-l">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
