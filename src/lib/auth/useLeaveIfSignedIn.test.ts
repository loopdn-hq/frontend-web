import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const router = { replace };
let auth: { session: unknown; isLoaded: boolean };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth/client", () => ({
  useAuth: () => auth,
  consumePostAuthRedirect: vi.fn(),
}));

import { consumePostAuthRedirect } from "@/lib/auth/client";
import { useLeaveIfSignedIn } from "@/lib/auth/useLeaveIfSignedIn";

beforeEach(() => {
  vi.clearAllMocks();
  auth = { session: null, isLoaded: false };
  vi.mocked(consumePostAuthRedirect).mockReturnValue(null);
});

describe("useLeaveIfSignedIn", () => {
  it("sends somebody who arrived signed in to this site's home", () => {
    auth = { session: { userId: "1" }, isLoaded: true };
    renderHook(() => useLeaveIfSignedIn());
    expect(replace).toHaveBeenCalledWith("/chats/");
  });

  it("prefers the page they asked for before being sent here", () => {
    vi.mocked(consumePostAuthRedirect).mockReturnValue("/enterprise/builder/");
    auth = { session: { userId: "1" }, isLoaded: true };
    renderHook(() => useLeaveIfSignedIn());
    expect(replace).toHaveBeenCalledWith("/enterprise/builder/");
  });

  it("waits until the session is known", () => {
    auth = { session: { userId: "1" }, isLoaded: false };
    const { rerender } = renderHook(() => useLeaveIfSignedIn());
    expect(replace).not.toHaveBeenCalled();

    auth = { session: { userId: "1" }, isLoaded: true };
    rerender();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("decides once: signing in on the page itself is the form's business", () => {
    auth = { session: null, isLoaded: true };
    const { rerender } = renderHook(() => useLeaveIfSignedIn());
    expect(replace).not.toHaveBeenCalled();

    auth = { session: { userId: "1" }, isLoaded: true };
    rerender();
    expect(replace).not.toHaveBeenCalled();
  });
});
