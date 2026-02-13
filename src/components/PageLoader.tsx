import { Skeleton } from '@/components/ui/skeleton';

export function PageLoader() {
  return (
    <div className="min-h-screen bg-background p-4 space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-end gap-1 h-32">
          {[...Array(12)].map((_, i) => (
            <Skeleton 
              key={i} 
              className="flex-1 rounded-t" 
              style={{ height: `${20 + Math.random() * 80}%` }} 
            />
          ))}
        </div>
      </div>

      {/* List skeleton */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
