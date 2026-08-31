import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-gray-500">404</p>

      <h1 className="mt-2 text-4xl font-bold tracking-tight">Page not found</h1>

      <p className="mt-4 max-w-md text-gray-600">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It may
        have been moved, deleted, or the URL may be incorrect.
      </p>

      <Link
        href="/"
        className="mt-8 rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        Go back home
      </Link>
    </main>
  );
}
