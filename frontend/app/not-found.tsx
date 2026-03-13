import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
      <h1 className="mb-2 font-[family-name:var(--font-heading)] text-6xl font-light tracking-tight">
        404
      </h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        This page doesn&apos;t exist. Maybe it migrated to another cloud region.
      </p>
      <Link
        href="/"
        className="rounded-lg border border-pawa-cyan/30 px-5 py-2.5 text-sm text-pawa-cyan transition-colors hover:bg-pawa-cyan/10"
      >
        Back to PawaCloud
      </Link>
    </div>
  );
}
