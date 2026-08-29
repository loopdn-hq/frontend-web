import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HomeShell } from "@/components/home/HomeShell";
import { DUMMY_ACCOUNT, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);

  if (!session?.value) {
    redirect("/login");
  }

  const displayName = session.value === "demo-admin" ? DUMMY_ACCOUNT.displayName : "New Member";

  return <HomeShell displayName={displayName} />;
}
