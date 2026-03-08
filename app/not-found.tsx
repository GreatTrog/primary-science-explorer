import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
      <div className="glass-panel rounded-[2rem] p-8">
        <p className="display-font text-5xl">Investigation not found</p>
        <p className="mt-4 text-muted">
          The requested investigation or session could not be loaded.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[var(--foreground)] px-5 font-semibold text-white"
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
