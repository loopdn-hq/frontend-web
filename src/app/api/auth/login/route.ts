import { NextResponse } from "next/server";
import {
  DUMMY_ACCOUNT,
  SESSION_COOKIE_NAME,
  isDummyCredential,
} from "@/lib/auth/session";
import { authPayloadSchema, toFieldErrors } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = authPayloadSchema.safeParse({ ...body, mode: "login" });

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Please correct the highlighted fields.",
        errors: toFieldErrors(parsed.error.issues),
      },
      { status: 400 },
    );
  }

  if (!isDummyCredential(parsed.data)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid credentials. Use the MVP demo account shown on the page.",
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    message: `Welcome back ${DUMMY_ACCOUNT.displayName}.`,
    redirectTo: "/home",
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "demo-admin",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
