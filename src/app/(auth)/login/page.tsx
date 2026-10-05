"use client";

import { AuthScreen } from "@/components/auth/AuthScreen";
import { useAuth } from "@/lib/auth/client";
import { useLeaveIfSignedIn } from "@/lib/auth/useLeaveIfSignedIn";

export default function LoginPage() {
  const { session } = useAuth();
  // Only for somebody who arrives signed in. After the form signs somebody
  // in, AuthScreen decides where they go - see the hook for why.
  useLeaveIfSignedIn();

  // Only `session`, deliberately NOT `!isLoaded`.
  //
  // useAuth's server snapshot is isLoaded=false, so gating on it rendered
  // nothing at build time and this page shipped as an EMPTY DOCUMENT - the form
  // and its SMS consent text existed only once JavaScript ran. That is invisible
  // in a browser and total to anything reading the page as served, which is how
  // a carrier compliance reviewer could not find the opt-in language at the very
  // URL the 10DLC campaign points at.
  //
  // `session` is null in the server snapshot too, so a signed-OUT visitor -
  // everyone who matters here - hydrates onto identical markup. A signed-IN one
  // briefly sees the form before useLeaveIfSignedIn redirects, which is the rarer
  // case and the cheaper one to pay.
  if (session) return null;

  return <AuthScreen initialMode="login" />;
}
