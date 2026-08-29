export function FormSkeleton() {
  return (
    <div className="space-y-4">
      {/* Email/Phone input skeleton */}
      <div className="block">
        <div className="mb-1 h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-12 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      </div>

      {/* Password input skeleton */}
      <div className="block">
        <div className="mb-1 h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-12 w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      </div>

      {/* Info message skeleton */}
      <div className="h-10 w-full animate-pulse rounded-xl border border-emerald-200 bg-emerald-50" />

      {/* Submit button skeleton */}
      <div className="h-12 w-full animate-pulse rounded-xl bg-slate-300" />
    </div>
  );
}

export function ProgressBar() {
  return (
    <div className="mt-4 overflow-hidden rounded-full bg-slate-200">
      <div className="h-1 w-full animate-pulse bg-gradient-to-r from-sky-400 via-sky-500 to-transparent" />
    </div>
  );
}
