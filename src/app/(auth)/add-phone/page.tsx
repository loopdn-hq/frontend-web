"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePhoneNumber, useAuth } from "@/lib/auth/client";

// New Google accounts have no phone_number yet - collect one here, then hand
// off to /verify-phone/ to confirm it.
export default function AddPhonePage() {
  const router = useRouter();
  const { session, isLoaded } = useAuth();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoaded && !session) {
      router.replace("/login/");
    }
  }, [router, isLoaded, session]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await updatePhoneNumber(phone);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push("/verify-phone/");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!session) return null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-12 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Add your phone number
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your Google account didn&apos;t include a phone number. Add one so
          your Loops can reach you over SMS.
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit} noValidate>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Phone number
            </span>
            <input
              type="tel"
              placeholder="+14155552671"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            />
            <span className="my-1 block text-xs font-normal text-slate-500">
              By providing your number, you agree to receive SMS messages from
              Loopd&apos;n. Msg & data rates may apply. Reply STOP to opt out.
            </span>
          </label>

          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || phone.trim().length === 0}
            className="w-full rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
