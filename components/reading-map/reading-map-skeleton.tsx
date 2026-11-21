import { Skeleton } from "@/components/ui/skeleton";

export function ReadingMapSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="grid flex-1 gap-5 px-4 py-5 lg:h-[calc(100dvh-var(--app-header))] lg:grid-cols-[minmax(0,1fr)_460px] lg:p-0"
    >
      <Skeleton className="order-2 h-[340px] rounded-2xl lg:order-1 lg:h-auto lg:rounded-none" />
      <div className="order-1 space-y-5 lg:order-2 lg:p-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="hidden h-40 rounded-2xl lg:block" />
      </div>
    </div>
  );
}
