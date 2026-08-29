import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { authPayloadSchema, normalizeContact, toFieldErrors } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = authPayloadSchema.safeParse({ ...body, mode: "signup" });

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

  const normalizedContact = normalizeContact(parsed.data.contactMode, parsed.data.contact);

  const response = NextResponse.json({
    ok: true,
    message: `Account created for ${normalizedContact}.`,
    redirectTo: "/home",
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "new-member",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
