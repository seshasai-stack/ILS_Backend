import { z } from "zod";

export const applicationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name must be under 100 characters"),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be under 255 characters"),

  phone: z
    .string()
    .trim()
    .min(6, "Please enter a valid phone number")
    .max(30, "Phone number must be under 30 characters")
    .regex(
      /^[0-9+\-\s()]+$/,
      "Phone number contains invalid characters"
    ),

  organization: z
    .string()
    .trim()
    .min(2, "Please enter your company or organization")
    .max(150, "Organization must be under 150 characters"),

  designation: z
    .string()
    .trim()
    .min(2, "Please enter your designation")
    .max(100, "Designation must be under 100 characters"),

  intent: z
    .string()
    .trim()
    .max(800, "Intent must be under 800 characters")
    .optional()
    .default(""),
});

export type ApplicationInput = z.infer<
  typeof applicationSchema
>;