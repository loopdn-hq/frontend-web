import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.");

const e164Phone = /^\+?[1-9]\d{7,14}$/;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be less than 73 characters.")
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/\d/, "Password must include at least one number.");

// POST /users/login/ accepts either a username or an email in the same field.
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username or email."),
  password: z.string().min(1, "Password is required."),
});

export type LoginPayload = z.infer<typeof loginSchema>;

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");

  return hasPlus ? `+${digitsOnly}` : digitsOnly;
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
    displayName: z
      .string()
      .trim()
      .max(50, "Must be less than 51 characters.")
      .optional(),
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
