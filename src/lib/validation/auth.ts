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
  .regex(/[A-Z]/, "Password must include at least one capital letter.")
  .regex(/\d/, "Password must include at least one number.")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must include at least one special character.",
  );

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
    // Email + phone are both required for signup.
    phoneNumber: z
      .string()
      .trim()
      .min(1, "Phone number is required.")
      .refine(
        (value) => e164Phone.test(normalizePhone(value)),
        "Enter a valid phone number including country code, e.g. +14155552671.",
      ),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignupPayload = z.infer<typeof signupSchema>;

// POST /users/forgot-password/
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordPayload = z.infer<typeof forgotPasswordSchema>;

// POST /users/reset-password/
export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;

// POST /users/change-password/ — no confirm field, per the backend contract.
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

export type ChangePasswordPayload = z.infer<typeof changePasswordSchema>;
