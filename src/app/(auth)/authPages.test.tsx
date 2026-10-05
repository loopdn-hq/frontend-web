import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };
let auth: { session: string | null; isLoaded: boolean };
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/auth/client", () => ({
  consumePostAuthRedirect: vi.fn(),
  getPendingEmail: vi.fn(),
  getPendingPhone: vi.fn(),
  requestPasswordReset: vi.fn(),
  requestPhoneVerificationCode: vi.fn(),
  resendEmailVerificationCode: vi.fn(),
  resetPassword: vi.fn(),
  setPendingEmail: vi.fn(),
  updatePhoneNumber: vi.fn(),
  useAuth: () => auth,
  verifyEmailCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
}));

import AddPhonePage from "@/app/(auth)/add-phone/page";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import ResetPasswordPage from "@/app/(auth)/reset-password/page";
import VerifyEmailPage from "@/app/(auth)/verify-email/page";
import VerifyPhonePage from "@/app/(auth)/verify-phone/page";
import {
  consumePostAuthRedirect,
  getPendingEmail,
  getPendingPhone,
  requestPasswordReset,
  requestPhoneVerificationCode,
  resendEmailVerificationCode,
  resetPassword,
  setPendingEmail,
  updatePhoneNumber,
  verifyEmailCode,
  verifyPhoneCode,
} from "@/lib/auth/client";
import { deferred, stubLocation } from "@/test/helpers";

type Result = { ok: true; displayName: string } | { ok: false; message: string };

function type(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  auth = { session: null, isLoaded: true };
  search = "";
  stubLocation("https://loopdn.com/");
  vi.mocked(consumePostAuthRedirect).mockReturnValue(null);
  vi.mocked(getPendingEmail).mockReturnValue("sam@example.com");
  vi.mocked(getPendingPhone).mockReturnValue(null);
  vi.mocked(resendEmailVerificationCode).mockResolvedValue({
    ok: true,
    displayName: "",
  });
  vi.mocked(requestPhoneVerificationCode).mockResolvedValue({
    ok: true,
    displayName: "",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("VerifyEmailPage", () => {
  it("sends a code to the pending address on arrival", async () => {
    render(<VerifyEmailPage />);
    expect(
      screen.getByText("Sending a verification code to sam@example.com..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();

    expect(
      await screen.findByText("We sent a code to sam@example.com."),
    ).toBeInTheDocument();
    expect(resendEmailVerificationCode).toHaveBeenCalledWith("sam@example.com");
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("says why a code could not be sent, and can try again", async () => {
    vi.mocked(resendEmailVerificationCode).mockResolvedValue({
      ok: false,
      message: "Too many attempts.",
    });
    render(<VerifyEmailPage />);
    expect((await screen.findAllByText("Too many attempts.")).length).toBeGreaterThan(0);

    vi.mocked(resendEmailVerificationCode).mockResolvedValue({
      ok: true,
      displayName: "",
    });
    click("Resend code");
    expect(
      await screen.findByText("We sent a new code to sam@example.com."),
    ).toBeInTheDocument();

    vi.mocked(resendEmailVerificationCode).mockResolvedValue({
      ok: false,
      message: "Still too many.",
    });
    click("Resend code");
    expect((await screen.findAllByText("Still too many.")).length).toBeGreaterThan(0);
  });

  it("verifies the code and moves on to the phone when one is pending", async () => {
    vi.mocked(getPendingPhone).mockReturnValue("+14155552671");
    const pending = deferred<Result>();
    vi.mocked(verifyEmailCode).mockReturnValue(pending.promise);
    render(<VerifyEmailPage />);
    await screen.findByText("We sent a code to sam@example.com.");

    type("123456", "424242");
    click("Verify");
    expect(screen.getByRole("button", { name: "Verifying..." })).toBeDisabled();
    expect(verifyEmailCode).toHaveBeenCalledWith("sam@example.com", "424242");

    await act(async () => pending.resolve({ ok: true, displayName: "Sam" }));
    expect(push).toHaveBeenCalledWith("/verify-phone/");
  });

  it("goes home, or back where they were headed, with no phone to verify", async () => {
    vi.mocked(verifyEmailCode).mockResolvedValue({ ok: true, displayName: "Sam" });
    const first = render(<VerifyEmailPage />);
    await screen.findByText("We sent a code to sam@example.com.");
    type("123456", "424242");
    click("Verify");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/chats/"));
    first.unmount();

    vi.mocked(consumePostAuthRedirect).mockReturnValue("/enterprise/builder/");
    render(<VerifyEmailPage />);
    await screen.findByText("We sent a code to sam@example.com.");
    type("123456", "424242");
    click("Verify");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/enterprise/builder/"));
  });

  it("shows a wrong code, and sends a verified-but-signed-out account to log in", async () => {
    vi.mocked(verifyEmailCode).mockResolvedValue({
      ok: false,
      message: "That code didn't work. Please try again.",
    });
    render(<VerifyEmailPage />);
    await screen.findByText("We sent a code to sam@example.com.");
    type("123456", "000000");
    click("Verify");
    expect(
      await screen.findByText("That code didn't work. Please try again."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    vi.mocked(verifyEmailCode).mockResolvedValue({
      ok: false,
      message: "Email verified. Please log in to continue.",
    });
    click("Verify");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login/"));
  });

  it("asks for an address when none is pending, and for a different one on request", async () => {
    vi.mocked(getPendingEmail).mockReturnValue(null);
    render(<VerifyEmailPage />);
    expect(resendEmailVerificationCode).not.toHaveBeenCalled();

    click("Send code");
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();

    type("you@example.com", "  alex@example.com ");
    click("Send code");
    expect(setPendingEmail).toHaveBeenCalledWith("alex@example.com");
    expect(
      await screen.findByText("We sent a code to alex@example.com."),
    ).toBeInTheDocument();

    click("Use a different email");
    expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
  });

  it("ignores a send that finishes after the page has gone", async () => {
    const pending = deferred<Result>();
    vi.mocked(resendEmailVerificationCode).mockReturnValue(pending.promise);
    const { unmount } = render(<VerifyEmailPage />);
    unmount();
    pending.resolve({ ok: true, displayName: "" });
    await expect(pending.promise).resolves.toBeTruthy();
  });

  it("sends somebody who arrived signed in straight on", () => {
    auth = { session: "sam", isLoaded: true };
    render(<VerifyEmailPage />);
    expect(replace).toHaveBeenCalledWith("/chats/");
  });
});

describe("VerifyPhonePage", () => {
  beforeEach(() => {
    auth = { session: "sam", isLoaded: true };
    vi.mocked(getPendingPhone).mockReturnValue("+14155552671");
  });

  it("texts a code on arrival and only then asks for it", async () => {
    render(<VerifyPhonePage />);
    expect(
      screen.getByText("Sending a verification code to +14155552671..."),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("123456")).not.toBeInTheDocument();

    expect(await screen.findByText("We sent a code to +14155552671.")).toBeInTheDocument();
    expect(requestPhoneVerificationCode).toHaveBeenCalledWith("+14155552671");
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Skip for now" }).getAttribute("href"),
    ).toMatch(/^\/chats\/?$/);
  });

  it("verifies the code and goes home, or back where they were headed", async () => {
    const pending = deferred<Result>();
    vi.mocked(verifyPhoneCode).mockReturnValue(pending.promise);
    const first = render(<VerifyPhonePage />);
    await screen.findByText("We sent a code to +14155552671.");
    type("123456", "424242");
    click("Verify");
    expect(screen.getByRole("button", { name: "Verifying..." })).toBeDisabled();
    await act(async () => pending.resolve({ ok: true, displayName: "" }));
    expect(verifyPhoneCode).toHaveBeenCalledWith("424242");
    expect(push).toHaveBeenCalledWith("/chats/");
    first.unmount();

    vi.mocked(verifyPhoneCode).mockResolvedValue({ ok: true, displayName: "" });
    vi.mocked(consumePostAuthRedirect).mockReturnValue("/enterprise/builder/");
    render(<VerifyPhonePage />);
    await screen.findByText("We sent a code to +14155552671.");
    type("123456", "424242");
    click("Verify");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/enterprise/builder/"));
  });

  it("shows a wrong code without leaving", async () => {
    vi.mocked(verifyPhoneCode).mockResolvedValue({
      ok: false,
      message: "That code didn't work. Please try again.",
    });
    render(<VerifyPhonePage />);
    await screen.findByText("We sent a code to +14155552671.");
    type("123456", "000000");
    click("Verify");
    expect(
      await screen.findByText("That code didn't work. Please try again."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("says why a code could not be sent, and can resend", async () => {
    vi.mocked(requestPhoneVerificationCode).mockResolvedValue({
      ok: false,
      message: "That number cannot receive texts.",
    });
    render(<VerifyPhonePage />);
    expect(
      (await screen.findAllByText("That number cannot receive texts.")).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("123456")).not.toBeInTheDocument();

    vi.mocked(requestPhoneVerificationCode).mockResolvedValue({
      ok: true,
      displayName: "",
    });
    click("Resend code");
    expect(
      await screen.findByText("We sent a new code to +14155552671."),
    ).toBeInTheDocument();

    vi.mocked(requestPhoneVerificationCode).mockResolvedValue({
      ok: false,
      message: "Slow down.",
    });
    click("Resend code");
    expect((await screen.findAllByText("Slow down.")).length).toBeGreaterThan(0);
  });

  it("sends a signed-out visitor to log in", () => {
    auth = { session: null, isLoaded: true };
    render(<VerifyPhonePage />);
    expect(replace).toHaveBeenCalledWith("/login/");
  });

  it("has nothing to do without a pending number, so it moves on", () => {
    vi.mocked(getPendingPhone).mockReturnValue(null);
    const { container } = render(<VerifyPhonePage />);
    expect(container).toBeEmptyDOMElement();
    expect(replace).toHaveBeenCalledWith("/chats/");
    expect(requestPhoneVerificationCode).not.toHaveBeenCalled();
  });

  it("waits for the session to be known before deciding anything", async () => {
    auth = { session: null, isLoaded: false };
    const pending = deferred<Result>();
    vi.mocked(requestPhoneVerificationCode).mockReturnValue(pending.promise);
    const { unmount } = render(<VerifyPhonePage />);
    expect(replace).not.toHaveBeenCalled();
    unmount();
    pending.resolve({ ok: true, displayName: "" });
    await expect(pending.promise).resolves.toBeTruthy();
  });
});

describe("AddPhonePage", () => {
  beforeEach(() => {
    auth = { session: "sam", isLoaded: true };
  });

  it("sends a signed-out visitor to log in, showing nothing", () => {
    auth = { session: null, isLoaded: true };
    const { container } = render(<AddPhonePage />);
    expect(container).toBeEmptyDOMElement();
    expect(replace).toHaveBeenCalledWith("/login/");
  });

  it("cannot be submitted empty", () => {
    render(<AddPhonePage />);
    expect(
      screen.getByRole("heading", { name: "Add your phone number" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("saves the number and goes on to verify it", async () => {
    const pending = deferred<Result>();
    vi.mocked(updatePhoneNumber).mockReturnValue(pending.promise);
    render(<AddPhonePage />);
    type("Enter your phone number", "+14155552671");
    click("Continue");

    expect(updatePhoneNumber).toHaveBeenCalledWith("+14155552671");
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    await act(async () => pending.resolve({ ok: true, displayName: "" }));
    expect(push).toHaveBeenCalledWith("/verify-phone/");
  });

  it("refuses a number that is not real, and clears the error when consent is ticked", () => {
    render(<AddPhonePage />);
    type("Enter your phone number", "+1 23");
    click("Continue");
    expect(
      screen.getByText("Enter a valid phone number including country code."),
    ).toBeInTheDocument();
    expect(updatePhoneNumber).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      screen.queryByText("Enter a valid phone number including country code."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("shows the server's reason when the number is refused", async () => {
    vi.mocked(updatePhoneNumber).mockResolvedValue({
      ok: false,
      message: "That number is already in use.",
    });
    render(<AddPhonePage />);
    type("Enter your phone number", "+14155552671");
    click("Continue");
    expect(
      await screen.findByText("That number is already in use."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("ForgotPasswordPage", () => {
  it("asks for a real address before sending anything", async () => {
    render(<ForgotPasswordPage />);
    click("Send reset link");
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("answers the same way whether or not the account exists", async () => {
    const pending = deferred<{ ok: boolean }>();
    vi.mocked(requestPasswordReset).mockReturnValue(pending.promise as never);
    render(<ForgotPasswordPage />);
    type("you@example.com", "sam@example.com");
    click("Send reset link");

    expect(await screen.findByRole("button", { name: "Sending..." })).toBeDisabled();
    await act(async () => pending.resolve({ ok: true }));
    expect(requestPasswordReset).toHaveBeenCalledWith("sam@example.com");
    expect(
      screen.getByText(
        "If an account exists for that email, a reset link has been sent.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("you@example.com")).not.toBeInTheDocument();
  });

  it("says something went wrong when the request itself failed", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ ok: false });
    render(<ForgotPasswordPage />);
    type("you@example.com", "sam@example.com");
    click("Send reset link");
    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();

    vi.mocked(requestPasswordReset).mockResolvedValue({ ok: true });
    click("Send reset link");
    expect(
      await screen.findByText(/a reset link has been sent/),
    ).toBeInTheDocument();
  });
});

describe("ResetPasswordPage", () => {
  function fill(password = "Str0ng!pass", confirm = password) {
    type("Create a new password", password);
    type("Re-enter your new password", confirm);
  }

  beforeEach(() => {
    search = "uid=u1&token=t1";
  });

  it("refuses a link that is missing its parts", () => {
    for (const query of ["", "uid=u1", "token=t1"]) {
      search = query;
      const view = render(<ResetPasswordPage />);
      expect(
        screen.getByText("This password reset link is invalid or has expired."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Request a new link" }).getAttribute("href"),
      ).toMatch(/^\/forgot-password\/?$/);
      view.unmount();
    }
  });

  it("validates the new password before sending it", async () => {
    render(<ResetPasswordPage />);
    fill("weak", "other");
    click("Reset password");
    expect(
      await screen.findByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("resets the password, then goes to log in after a moment", async () => {
    vi.useFakeTimers();
    vi.mocked(resetPassword).mockResolvedValue({ ok: true });
    render(<ResetPasswordPage />);
    fill();
    click("Reset password");
    // Validation and the request are both promises; let them settle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(
      screen.getByText("Your password has been reset. Redirecting you to log in..."),
    ).toBeInTheDocument();
    expect(resetPassword).toHaveBeenCalledWith({
      uid: "u1",
      token: "t1",
      newPassword: "Str0ng!pass",
      confirmPassword: "Str0ng!pass",
    });
    expect(
      screen.getByRole("link", { name: "Go to login" }).getAttribute("href"),
    ).toMatch(/^\/login\/?$/);
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(push).toHaveBeenCalledWith("/login/");
  });

  it("puts the server's field errors beside their fields", async () => {
    vi.mocked(resetPassword).mockResolvedValue({
      ok: false,
      message: "This password is too common.",
      fieldErrors: {
        new_password: ["This password is too common."],
        confirm_password: ["Does not match."],
      },
      invalidOrExpired: false,
    });
    render(<ResetPasswordPage />);
    fill();
    click("Reset password");

    expect(await screen.findByText("Does not match.")).toBeInTheDocument();
    // Shown once beside its field and once as the general message.
    expect(screen.getAllByText("This password is too common.")).toHaveLength(2);
  });

  it("shows other errors in place of the general message", async () => {
    vi.mocked(resetPassword).mockResolvedValue({
      ok: false,
      message: "Something else.",
      fieldErrors: { non_field_errors: ["Try again in a minute."] },
      invalidOrExpired: false,
    });
    render(<ResetPasswordPage />);
    fill();
    click("Reset password");

    expect(await screen.findByText("Try again in a minute.")).toBeInTheDocument();
    expect(screen.queryByText("Something else.")).not.toBeInTheDocument();
  });

  it("switches to the expired-link message when the server says so", async () => {
    const pending = deferred<Awaited<ReturnType<typeof resetPassword>>>();
    vi.mocked(resetPassword).mockReturnValue(pending.promise);
    render(<ResetPasswordPage />);
    fill();
    click("Reset password");
    expect(await screen.findByRole("button", { name: "Resetting..." })).toBeDisabled();

    await act(async () =>
      pending.resolve({
        ok: false,
        message: "This link has expired.",
        fieldErrors: { token: ["This link has expired."] },
        invalidOrExpired: true,
      }),
    );
    expect(
      screen.getByText("This password reset link is invalid or has expired."),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Create a new password")).not.toBeInTheDocument();
  });
});
