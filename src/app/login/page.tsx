import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);

  if (session?.value) {
    redirect("/home");
  }

  return <AuthScreen initialMode="login" />;
}
