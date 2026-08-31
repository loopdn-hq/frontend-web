import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.");

const phoneCharacters = /^[0-9+()\-\s]+$/;
const e164Phone = /^\+?[1-9]\d{7,14}$/;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be less than 73 characters.")
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/\d/, "Password must include at least one number.");

export const authPayloadSchema = z
  .object({
    mode: z.enum(["login", "signup"]),
    contactMode: z.enum(["email", "phone"]),
    contact: z.string().trim().min(1, "Email or phone is required."),
    password: passwordSchema,
  })
  .superRefine((value, ctx) => {
    if (value.contactMode === "email") {
      const result = emailSchema.safeParse(value.contact);

      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contact"],
          message: "Enter a valid email address.",
        });
      }

      return;
    }

    const rawPhone = value.contact.trim();

    if (!phoneCharacters.test(rawPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact"],
        message: "Phone can include only digits and + ( ) - symbols.",
      });
      return;
    }

    const normalized = normalizePhone(rawPhone);

    if (!e164Phone.test(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact"],
        message: "Enter a valid phone number including country code.",
      });
    }
  });

export type AuthPayload = z.infer<typeof authPayloadSchema>;

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");

  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

export function normalizeContact(
  contactMode: AuthPayload["contactMode"],
  contact: string,
): string {
  if (contactMode === "email") {
    return contact.trim().toLowerCase();
  }

  return normalizePhone(contact);
}

export function toFieldErrors(
  issues: z.ZodIssue[],
): Partial<Record<"contact" | "password", string>> {
  const errors: Partial<Record<"contact" | "password", string>> = {};

  for (const issue of issues) {
    const key = issue.path[0];

    if ((key === "contact" || key === "password") && !errors[key]) {
      errors[key] = issue.message;
    }
  }

  return errors;
}

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username must be less than 31 characters.")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Username can only contain letters, numbers, and . _ -",
  );

const requiredNameSchema = z
  .string()
  .trim()
  .min(1, "This field is required.")
  .max(50, "Must be less than 51 characters.");

export const signupSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
    firstName: requiredNameSchema,
    lastName: requiredNameSchema,
    displayName: z.string().trim().max(50, "Must be less than 51 characters.").optional(),
    // Optional here: email signup leaves this blank, phone signup (the other tab) requires it.
    phoneNumber: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || e164Phone.test(normalizePhone(value)),
        "Enter a valid phone number including country code, e.g. +14155552671.",
      ),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignupPayload = z.infer<typeof signupSchema>;

export type SignupFieldErrors = Partial<
  Record<keyof SignupPayload, string>
>;

const signupFieldKeys = new Set<keyof SignupPayload>([
  "username",
  "email",
  "password",
  "confirmPassword",
  "firstName",
  "lastName",
  "displayName",
  "phoneNumber",
]);

export function toSignupFieldErrors(issues: z.ZodIssue[]): SignupFieldErrors {
  const errors: SignupFieldErrors = {};

  for (const issue of issues) {
    const key = issue.path[0];

    if (
      typeof key === "string" &&
      signupFieldKeys.has(key as keyof SignupPayload) &&
      !errors[key as keyof SignupPayload]
    ) {
      errors[key as keyof SignupPayload] = issue.message;
    }
  }

  return errors;
}
