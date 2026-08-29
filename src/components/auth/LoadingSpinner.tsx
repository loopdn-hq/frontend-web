export function LoadingSpinner() {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      <span>Processing...</span>
    </div>
  );
}
