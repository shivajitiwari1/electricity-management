export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="rounded-lg border overflow-hidden">
        <div className="h-12 bg-muted/50" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 border-t bg-muted/20 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
