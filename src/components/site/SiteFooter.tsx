import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto mt-10 w-full max-w-[1440px] border-t border-[#96c5ff]/35 px-4 pb-10 pt-8 sm:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Image
            src="/home-logo.png"
            alt="Loopd'n"
            width={115}
            height={26}
            className="h-auto w-[108px]"
          />
          <p className="mt-4 max-w-md text-xs leading-6 text-[#3e669c] dark:text-[#87afe3]">
            Loopdn keeps groups connected through SMS, voice, and web in one
            shared conversation everyone can access.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#173a75] dark:text-[#d6e8ff]">
            Product
          </p>
          <div className="mt-3 space-y-2 text-sm text-[#3e669c] dark:text-[#87afe3]">
            <Link href="/#how-it-works" className="block hover:underline">
              How It Works
            </Link>
            <Link href="/pricing/" className="block hover:underline">
              Pricing
            </Link>
            <Link href="/#groupme-alt" className="block hover:underline">
              GroupMe Alternative
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#173a75] dark:text-[#d6e8ff]">
            Company
          </p>
          <div className="mt-3 space-y-2 text-sm text-[#3e669c] dark:text-[#87afe3]">
            <Link href="/contact/" className="block hover:underline">
              Contact
            </Link>
            <Link href="/privacy/" className="block hover:underline">
              Privacy
            </Link>
            <Link href="/terms/" className="block hover:underline">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-2 border-t border-[#96c5ff]/30 pt-4 text-[11px] text-[#4f73a8] dark:text-[#8aaedf] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Loopd&apos;n. All rights reserved.</p>
        <p>Built to keep every group connected.</p>
      </div>
    </footer>
  );
}
