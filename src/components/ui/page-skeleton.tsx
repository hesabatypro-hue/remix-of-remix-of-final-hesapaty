import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl border border-border/50 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/50 p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-3">
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransfersSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-border/50 space-y-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BranchesSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="px-5 py-3 border-t border-border">
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
