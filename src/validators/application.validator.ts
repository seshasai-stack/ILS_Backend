import { z } from "zod";

export const applicationSchema = z
  .object({
    registrationType: z.string().trim().min(1).max(100),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(30)
      .regex(/^[0-9+\-\s()]+$/, "Phone number contains invalid characters"),
    chapterName: z.string().trim().min(2).max(150),
    organization: z.string().trim().min(2).max(150),
    designation: z.string().trim().min(2).max(100),
    industry: z.string().trim().min(1).max(150),
    industryOther: z.string().trim().max(150).optional().default(""),
    sponsorshipInterest: z.string().trim().max(100).optional().default(""),
    sponsorshipDetails: z.string().trim().max(500).optional().default(""),
    dietaryRestrictions: z.array(z.string().trim().min(1).max(100)).min(1),
    dietaryOther: z.string().trim().max(150).optional().default(""),
    address1: z.string().trim().min(2).max(250),
    address2: z.string().trim().max(250).optional().default(""),
    country: z.string().trim().min(1).max(100),
    city: z.string().trim().min(2).max(100),
    stateProvince: z.string().trim().max(100).optional().default(""),
    postalCode: z.string().trim().min(2).max(30),
    vatGstNumber: z.string().trim().max(100).optional().default(""),
    intent: z.string().trim().max(800).optional().default(""),
  })
  .superRefine((data, context) => {
    if (data.industry === "Other" && !data.industryOther) {
      context.addIssue({ code: "custom", path: ["industryOther"], message: "Please specify your industry" });
    }
    if (data.dietaryRestrictions.includes("Other") && !data.dietaryOther) {
      context.addIssue({ code: "custom", path: ["dietaryOther"], message: "Please specify your dietary restriction" });
    }
  });

export type ApplicationInput = z.infer<typeof applicationSchema>;
