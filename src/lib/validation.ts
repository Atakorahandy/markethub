import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(200);

/** Ghana phone: 0XXXXXXXXX or +233XXXXXXXXX — normalised to 0XXXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^(0\d{9}|\+233\d{9}|233\d{9})$/.test(v), "Enter a valid Ghana phone number.")
  .transform((v) => (v.startsWith("0") ? v : "0" + v.replace(/^\+?233/, "")));

// Standard applied everywhere a password is set (registration, password
// reset): at least 8 characters, mixing letters, numbers, AND a symbol —
// surfaced to the user as visible helper text on those forms (not just a
// rejection after the fact), in src/app/(auth)/register/page.tsx and
// src/app/(auth)/reset/page.tsx.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v), "Include at least one letter.")
  .refine((v) => /[0-9]/.test(v), "Include at least one number.")
  .refine((v) => /[^a-zA-Z0-9]/.test(v), "Include at least one symbol (e.g. ! @ # $ %).");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
});

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export const idSchema = z.string().cuid();
