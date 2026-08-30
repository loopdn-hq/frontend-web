import type { AuthPayload } from "@/lib/validation/auth";
import { normalizeContact } from "@/lib/validation/auth";

export const SESSION_COOKIE_NAME = "loopdn_session";

export const DUMMY_ACCOUNT = {
  displayName: "Demo Admin",
  email: "demo@loopdn.app",
  phone: "+15551234567",
  password: "Loopdn123!",
} as const;

export function isDummyCredential(payload: AuthPayload): boolean {
  const normalizedInput = normalizeContact(
    payload.contactMode,
    payload.contact,
  );

  if (payload.contactMode === "email") {
    return (
      normalizedInput === DUMMY_ACCOUNT.email.toLowerCase() &&
      payload.password === DUMMY_ACCOUNT.password
    );
  }

  return (
    normalizedInput === DUMMY_ACCOUNT.phone &&
    payload.password === DUMMY_ACCOUNT.password
  );
}
