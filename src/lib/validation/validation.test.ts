import { afterEach, describe, expect, it, vi } from "vitest";

import { stubLocation } from "@/test/helpers";
import {
  changePasswordSchema,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  normalizePhone,
  passwordSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";
import {
  GROUP_DESCRIPTION_MAX,
  groupDescriptionSchema,
  groupNameSchema,
} from "@/lib/validation/group";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The messages a schema refuses a value with, in order. */
function problems(
  schema: { safeParse: (value: unknown) => unknown },
  value: unknown,
) {
  const result = schema.safeParse(value) as {
    success: boolean;
    error?: { issues: { message: string; path: (string | number)[] }[] };
  };
  return result.success ? [] : result.error!.issues.map((i) => i.message);
}

describe("email and password", () => {
  it("trims an email and refuses one that is not", () => {
    expect(emailSchema.parse("  sam@example.com ")).toBe("sam@example.com");
    expect(problems(emailSchema, "sam@")).toEqual([
      "Enter a valid email address.",
    ]);
  });

  it("names each thing a password is missing", () => {
    expect(problems(passwordSchema, "Str0ng!pass")).toEqual([]);
    expect(problems(passwordSchema, "short")).toEqual([
      "Password must be at least 8 characters.",
      "Password must include at least one capital letter.",
      "Password must include at least one number.",
      "Password must include at least one special character.",
    ]);
    expect(problems(passwordSchema, `Aa1!${"x".repeat(70)}`)).toEqual([
      "Password must be less than 73 characters.",
    ]);
  });
});

describe("loginSchema", () => {
  it("takes a username or an email in the one field", () => {
    expect(loginSchema.parse({ username: " sam ", password: "x" })).toEqual({
      username: "sam",
      password: "x",
    });
  });

  it("asks for both", () => {
    expect(problems(loginSchema, { username: "  ", password: "" })).toEqual([
      "Enter your username or email.",
      "Password is required.",
    ]);
  });
});

describe("normalizePhone", () => {
  it("returns a real number in E.164", () => {
    expect(normalizePhone("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("keeps the digits of one it cannot validate", () => {
    expect(normalizePhone("+1 23")).toBe("+123");
    expect(normalizePhone("(555) 01")).toBe("55501");
  });

  it("returns nothing for nothing", () => {
    expect(normalizePhone("   ")).toBe("");
    expect(normalizePhone("+")).toBe("");
  });
});

describe("signupSchema", () => {
  const valid = {
    username: "sam_w",
    email: "sam@example.com",
    password: "Str0ng!pass",
    confirmPassword: "Str0ng!pass",
    firstName: "Sam",
    lastName: "Wren",
    phoneNumber: "+14155552671",
  };

  it("accepts a complete signup", () => {
    stubLocation("https://loopdn.com/signup/");
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses passwords that do not match, against the confirm field", () => {
    stubLocation("https://loopdn.com/signup/");
    const result = signupSchema.safeParse({
      ...valid,
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]).toMatchObject({
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    });
  });

  it("requires a phone on the chat site", () => {
    stubLocation("https://loopdn.com/signup/");
    expect(problems(signupSchema, { ...valid, phoneNumber: "" })).toEqual([
      "Phone number is required.",
    ]);
  });

  it("does not on the commercial site, though a number given must be real", () => {
    stubLocation("https://commercial.loopdn.com/signup/");
    expect(signupSchema.safeParse({ ...valid, phoneNumber: "" }).success).toBe(
      true,
    );
    expect(problems(signupSchema, { ...valid, phoneNumber: "12345" })).toEqual([
      "Enter a valid phone number including country code.",
    ]);
  });

  it("holds the username and names to their limits", () => {
    stubLocation("https://loopdn.com/signup/");
    expect(problems(signupSchema, { ...valid, username: "ab" })).toEqual([
      "Username must be at least 3 characters.",
    ]);
    expect(problems(signupSchema, { ...valid, username: "sam w!" })).toEqual([
      "Username can only contain letters, numbers, and . _ -",
    ]);
    expect(
      problems(signupSchema, { ...valid, username: "a".repeat(31) }),
    ).toEqual(["Username must be less than 31 characters."]);
    expect(problems(signupSchema, { ...valid, firstName: " " })).toEqual([
      "This field is required.",
    ]);
    expect(
      problems(signupSchema, { ...valid, lastName: "x".repeat(51) }),
    ).toEqual(["Must be less than 51 characters."]);
    expect(
      problems(signupSchema, { ...valid, displayName: "x".repeat(51) }),
    ).toEqual(["Must be less than 51 characters."]);
  });
});

describe("password forms", () => {
  it("forgot password wants an email", () => {
    expect(problems(forgotPasswordSchema, { email: "nope" })).toEqual([
      "Enter a valid email address.",
    ]);
  });

  it("reset password wants two that match", () => {
    expect(
      resetPasswordSchema.safeParse({
        newPassword: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
      }).success,
    ).toBe(true);
    expect(
      problems(resetPasswordSchema, {
        newPassword: "Str0ng!pass",
        confirmPassword: "",
      }),
    ).toEqual(["Confirm your new password.", "Passwords do not match."]);
  });

  it("change password wants the current one and a strong new one", () => {
    expect(
      problems(changePasswordSchema, { oldPassword: "", newPassword: "weak" }),
    ).toContain("Enter your current password.");
    expect(
      changePasswordSchema.safeParse({
        oldPassword: "old",
        newPassword: "Str0ng!pass",
      }).success,
    ).toBe(true);
  });
});

describe("group name and description", () => {
  it("trims a name and holds it between 3 and 50 characters", () => {
    expect(groupNameSchema.parse("  Book club ")).toBe("Book club");
    expect(problems(groupNameSchema, "  ")).toEqual([
      "Loop name is required",
      "Loop name must be at least 3 characters",
    ]);
    expect(problems(groupNameSchema, "ab")).toEqual([
      "Loop name must be at least 3 characters",
    ]);
    expect(problems(groupNameSchema, "x".repeat(51))).toEqual([
      "Loop name must be 50 characters or less",
    ]);
  });

  it("allows a description up to the server's column and no further", () => {
    expect(
      groupDescriptionSchema.safeParse("x".repeat(GROUP_DESCRIPTION_MAX))
        .success,
    ).toBe(true);
    expect(
      problems(groupDescriptionSchema, "x".repeat(GROUP_DESCRIPTION_MAX + 1)),
    ).toEqual(["Description must be 280 characters or less"]);
  });
});
