import Link from "next/link";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";

type ComingSoonProps = {
  title: string;
  description: string;
};

/**
 * Placeholder for a nav destination that has no implementation yet.
 *
 * Deliberately says so rather than mocking up an empty state, because none of
 * these have backend endpoints - the API exposes conversations and nothing else.
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <NavDrawerButton className="absolute top-4 left-4 bg-slate-900 text-white" />
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
          This section isn&apos;t built yet.
        </p>
        <Link
          href="/chats/"
          className="mt-6 inline-block rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Chats
        </Link>
      </div>
    </div>
  );
}
