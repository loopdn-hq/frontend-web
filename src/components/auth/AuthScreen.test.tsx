import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };
let auth: { session: string | null; isLoaded: boolean };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@react-oauth/google", () => ({
  // Three buttons standing in for Google's own: a credential, none, a failure.
  GoogleLogin: ({
    onSuccess,
    onError,
    text,
  }: {
    onSuccess: (response: { credential?: string }) => void;
    onError: () => void;
    text: string;
  }) => (
    <div data-testid="google" data-text={text}>
      <button type="button" onClick={() => onSuccess({ credential: "google-jwt" })}>
        Google
      </button>
      <button type="button" onClick={() => onSuccess({})}>
        Google without credential
      </button>
      <button type="button" onClick={() => onError()}>
        Google fails
      </button>
    </div>
  ),
}));
vi.mock("@/lib/auth/client", () => ({
  authenticate: vi.fn(),
  authenticateWithGoogle: vi.fn(),
  consumePostAuthRedirect: vi.fn(),
  registerAccount: vi.fn(),
  setPendingEmail: vi.fn(),
  stashPendingCredentials: vi.fn(),
  useAuth: () => auth,
}));

import LoginPage from "@/app/(auth)/login/page";
import SignupPage from "@/app/(auth)/signup/page";
import { AuthScreen } from "@/components/auth/AuthScreen";
import {
  authenticate,
  authenticateWithGoogle,
  consumePostAuthRedirect,
  registerAccount,
  setPendingEmail,
  stashPendingCredentials,
} from "@/lib/auth/client";
import { deferred, stubLocation } from "@/test/helpers";

function type(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
}

function submit(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function fillLogin(username = "sam@example.com", password = "pw") {
  type("sam.loopdn", username);
  type("Enter your password", password);
}

function fillSignup(overrides: Record<string, string> = {}) {
  const values = {
    username: "sam_w",
    email: "sam@example.com",
    phone: "+14155552671",
    first: "sam",
    last: "wren",
    password: "Str0ng!pass",
    confirm: "Str0ng!pass",
    ...overrides,
  };
  type("sam.loopdn", values.username);
  type("you@example.com", values.email);
  type("Enter your phone number", values.phone);
  type("Sam", values.first);
  type("Taylor", values.last);
  type("Create a password", values.password);
  type("Re-enter your password", values.confirm);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth = { session: null, isLoaded: true };
  stubLocation("https://loopdn.com/login/");
  vi.mocked(consumePostAuthRedirect).mockReturnValue(null);
  vi.mocked(authenticate).mockResolvedValue({ ok: true, displayName: "Sam" });
  vi.mocked(registerAccount).mockResolvedValue({ ok: true, displayName: "Sam" });
  vi.mocked(authenticateWithGoogle).mockResolvedValue({
    ok: true,
    displayName: "Sam",
    isNewAccount: false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthScreen - logging in", () => {
  it("welcomes somebody back and offers the three ways in", () => {
    render(<AuthScreen initialMode="login" />);
    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
    expect(screen.getByTestId("google")).toHaveAttribute("data-text", "signin_with");
    expect(screen.getByText("or continue with email")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href"),
    ).toMatch(/^\/forgot-password\/?$/);
    expect(screen.getByRole("link", { name: "Sign Up" })).toBeInTheDocument();
    expect(screen.getByAltText("Loopd'n")).toBeInTheDocument();
    expect(screen.getByText("One conversation. Every channel.")).toBeInTheDocument();
  });

  it("asks for both fields before calling the server", async () => {
    render(<AuthScreen initialMode="login" />);
    submit("Continue with email");
    expect(await screen.findByText("Enter your username or email.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("signs in and goes to this site's home", async () => {
    render(<AuthScreen initialMode="login" />);
    fillLogin();
    submit("Continue with email");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/chats/"));
    expect(authenticate).toHaveBeenCalledWith({
      username: "sam@example.com",
      password: "pw",
    });
  });

  it("goes back to the page that sent them here, when there was one", async () => {
    vi.mocked(consumePostAuthRedirect).mockReturnValue("/enterprise/builder/");
    render(<AuthScreen initialMode="login" />);
    fillLogin();
    submit("Continue with email");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/enterprise/builder/"));
  });

  it("locks the form while the request is out", async () => {
    const pending = deferred<Awaited<ReturnType<typeof authenticate>>>();
    vi.mocked(authenticate).mockReturnValue(pending.promise);
    render(<AuthScreen initialMode="login" />);
    fillLogin();
    submit("Continue with email");

    expect(await screen.findByText("Processing...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("sam.loopdn")).toBeDisabled();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveClass(
      "pointer-events-none",
    );

    pending.resolve({ ok: true, displayName: "Sam" });
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(screen.getByPlaceholderText("sam.loopdn")).toBeEnabled();
  });

  it("shows the server's reason for a refusal", async () => {
    vi.mocked(authenticate).mockResolvedValue({
      ok: false,
      message: "Incorrect username or password.",
    });
    render(<AuthScreen initialMode="login" />);
    fillLogin();
    submit("Continue with email");
    expect(
      await screen.findByText("Incorrect username or password."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("sends an unverified account to enter its code, keeping what was typed", async () => {
    vi.mocked(authenticate).mockResolvedValue({
      ok: false,
      message: "Please verify your email first.",
      emailNotVerified: true,
    });
    render(<AuthScreen initialMode="login" />);
    fillLogin("sam@example.com", "Str0ng!pass");
    submit("Continue with email");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify-email/"));
    expect(setPendingEmail).toHaveBeenCalledWith("sam@example.com");
    expect(stashPendingCredentials).toHaveBeenCalledWith(
      "sam@example.com",
      "Str0ng!pass",
    );
  });

  it("reports a request that threw", async () => {
    vi.mocked(authenticate).mockRejectedValue(new Error("boom"));
    render(<AuthScreen initialMode="login" />);
    fillLogin();
    submit("Continue with email");
    expect(
      await screen.findByText("Network error. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows and hides the password", () => {
    render(<AuthScreen initialMode="login" />);
    const password = screen.getByPlaceholderText("Enter your password");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });
});

describe("AuthScreen - Google", () => {
  it("signs in with Google and goes home", async () => {
    render(<AuthScreen initialMode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Google" }));
    expect(screen.getByText("Connecting to Google...")).toBeInTheDocument();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/chats/"));
    expect(authenticateWithGoogle).toHaveBeenCalledWith("google-jwt");
    expect(screen.queryByText("Connecting to Google...")).not.toBeInTheDocument();
  });

  it("sends a brand-new chat account to add a phone number", async () => {
    vi.mocked(authenticateWithGoogle).mockResolvedValue({
      ok: true,
      displayName: "Sam",
      isNewAccount: true,
    });
    render(<AuthScreen initialMode="signup" />);
    fireEvent.click(screen.getByRole("button", { name: "Google" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/add-phone/"));
  });

  it("does not ask a new commercial or admin account for a phone", async () => {
    vi.mocked(authenticateWithGoogle).mockResolvedValue({
      ok: true,
      displayName: "Sam",
      isNewAccount: true,
    });
    stubLocation("https://commercial.loopdn.com/login/");
    const commercial = render(<AuthScreen initialMode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Google" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    commercial.unmount();

    stubLocation("https://admin.loopdn.com/login/");
    render(<AuthScreen initialMode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Google" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/"));
  });

  it("explains each way Google can fail", async () => {
    render(<AuthScreen initialMode="login" />);

    fireEvent.click(screen.getByRole("button", { name: "Google without credential" }));
    expect(
      screen.getByText("Google didn't return a credential. Please try again."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Google fails" }));
    expect(
      screen.getByText("Unable to continue with Google. Please try again."),
    ).toBeInTheDocument();

    vi.mocked(authenticateWithGoogle).mockResolvedValue({
      ok: false,
      message: "That Google account is disabled.",
    });
    fireEvent.click(screen.getByRole("button", { name: "Google" }));
    expect(
      await screen.findByText("That Google account is disabled."),
    ).toBeInTheDocument();

    vi.mocked(authenticateWithGoogle).mockRejectedValue(new Error("boom"));
    fireEvent.click(screen.getByRole("button", { name: "Google" }));
    expect(
      await screen.findByText("Network error. Please try again."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("AuthScreen - signing up", () => {
  it("asks for an email and a phone on the chat site", () => {
    render(<AuthScreen initialMode="signup" />);
    expect(
      screen.getByRole("heading", { name: "Create your Loopd'n account" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("google")).toHaveAttribute("data-text", "signup_with");
    expect(screen.getByText("or sign up with email")).toBeInTheDocument();
    expect(
      screen.getByText("Create an account with your email and phone number."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\(optional\)/)).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("registers with a display name built from the two names, then asks for the email code", async () => {
    render(<AuthScreen initialMode="signup" />);
    fillSignup();
    submit("Create account");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify-email/"));
    expect(registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "sam_w",
        email: "sam@example.com",
        phoneNumber: "+14155552671",
        firstName: "sam",
        lastName: "wren",
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
        displayName: "sam W.",
      }),
    );
  });

  it("names every missing field instead of registering", async () => {
    render(<AuthScreen initialMode="signup" />);
    submit("Create account");

    expect(
      await screen.findByText("Username must be at least 3 characters."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Phone number is required.")).toBeInTheDocument();
    expect(screen.getAllByText("This field is required.")).toHaveLength(2);
    expect(
      screen.getByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirm your password.")).toBeInTheDocument();
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it("refuses passwords that do not match", async () => {
    render(<AuthScreen initialMode="signup" />);
    fillSignup({ confirm: "Different1!" });
    submit("Create account");
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it("shows the server's reason for a refusal, and a request that threw", async () => {
    vi.mocked(registerAccount).mockResolvedValue({
      ok: false,
      message: "That username is taken.",
    });
    render(<AuthScreen initialMode="signup" />);
    fillSignup();
    submit("Create account");
    expect(await screen.findByText("That username is taken.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    vi.mocked(registerAccount).mockRejectedValue(new Error("boom"));
    submit("Create account");
    expect(
      await screen.findByText("Network error. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows and hides each password on its own", () => {
    render(<AuthScreen initialMode="signup" />);
    const password = screen.getByPlaceholderText("Create a password");
    const confirm = screen.getByPlaceholderText("Re-enter your password");
    const [showPassword, showConfirm] = screen.getAllByRole("button", {
      name: "Show password",
    });

    fireEvent.click(showPassword);
    expect(password).toHaveAttribute("type", "text");
    expect(confirm).toHaveAttribute("type", "password");

    fireEvent.click(showConfirm);
    expect(confirm).toHaveAttribute("type", "text");
    fireEvent.click(screen.getAllByRole("button", { name: "Hide password" })[0]);
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(confirm).toHaveAttribute("type", "password");
  });

  it("makes the phone optional on the commercial site", async () => {
    stubLocation("https://commercial.loopdn.com/signup/");
    render(<AuthScreen initialMode="signup" />);
    expect(
      screen.getByRole("heading", { name: "Create your commercial account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create an account with your email. A phone number is optional.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/\(optional\)/)).toBeInTheDocument();

    fillSignup({ phone: "", first: "", last: "Wren" });
    type("Sam", "");
    submit("Create account");
    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
    expect(screen.queryByText("Phone number is required.")).not.toBeInTheDocument();
  });

  it("builds the display name from whichever names it has", async () => {
    stubLocation("https://commercial.loopdn.com/signup/");
    render(<AuthScreen initialMode="signup" />);
    fillSignup({ phone: "", first: "  Sam ", last: "W" });
    submit("Create account");
    await waitFor(() =>
      expect(registerAccount).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: "Sam W." }),
      ),
    );
  });
});

describe("AuthScreen - switching", () => {
  it("switches between the two forms, clearing what the other one said", async () => {
    vi.mocked(authenticate).mockResolvedValue({ ok: false, message: "Nope." });
    render(<AuthScreen initialMode="login" />);
    fillLogin();
    submit("Continue with email");
    expect(await screen.findByText("Nope.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Sign Up" }));
    expect(
      screen.getByRole("heading", { name: "Create your Loopd'n account" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nope.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Log In" }));
    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("sam.loopdn")).toHaveValue("");
  });

  it("offers no sign-up on the admin site: admin accounts are not made here", () => {
    stubLocation("https://admin.loopdn.com/login/");
    render(<AuthScreen initialMode="login" />);
    expect(screen.queryByRole("link", { name: "Sign Up" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Sign in with your Loopd'n admin account."),
    ).toBeInTheDocument();
  });
});

describe("the login and signup pages", () => {
  it("show the right form to a visitor", () => {
    const login = render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeInTheDocument();
    login.unmount();

    render(<SignupPage />);
    expect(
      screen.getByRole("heading", { name: "Create your Loopd'n account" }),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("show nothing to somebody already signed in, and send them on", () => {
    auth = { session: "sam", isLoaded: true };
    const login = render(<LoginPage />);
    expect(login.container).toBeEmptyDOMElement();
    expect(replace).toHaveBeenCalledWith("/chats/");
    login.unmount();

    const signup = render(<SignupPage />);
    expect(signup.container).toBeEmptyDOMElement();
    expect(replace).toHaveBeenCalledTimes(2);
  });
});
