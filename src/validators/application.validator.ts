import { z } from "zod";

export const applicationSchema = z
  .object({
    registrationType: z.enum([
      "Member",
      "Chapter Director",
      "Member + Spouse",
      "Executive Director",
      "Spouse",
      "Guest / Non-member",
      "Guest/Non-member",
    ]),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(30)
      .regex(/^[0-9+\-\s()]+$/, "Phone number contains invalid characters"),
    chapterName: z.string().trim().max(150),
    organization: z.string().trim().max(150).optional().default(""),
    designation: z.string().trim().max(100).optional().default(""),
    industry: z.string().trim().max(150).optional().default(""),
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
    const isSpouse = data.registrationType === "Spouse";
    if (data.chapterName.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["chapterName"],
        message: isSpouse ? "Please enter the spouse name" : "Please enter your chapter name, market or region",
      });
    }
    if (!isSpouse && data.organization.length < 2) {
      context.addIssue({ code: "custom", path: ["organization"], message: "Please enter your company" });
    }
    if (!isSpouse && data.designation.length < 2) {
      context.addIssue({ code: "custom", path: ["designation"], message: "Please enter your role" });
    }
    if (!isSpouse && !data.industry) {
      context.addIssue({ code: "custom", path: ["industry"], message: "Please select your industry" });
    }
    if (!isSpouse && data.industry === "Other" && !data.industryOther) {
      context.addIssue({ code: "custom", path: ["industryOther"], message: "Please specify your industry" });
    }
    if (data.dietaryRestrictions.includes("Other") && !data.dietaryOther) {
      context.addIssue({ code: "custom", path: ["dietaryOther"], message: "Please specify your dietary restriction" });
    }
  })
  .transform((data) => {
    const registrationType = data.registrationType === "Guest/Non-member"
      ? "Guest / Non-member"
      : data.registrationType;

    return registrationType === "Spouse"
      ? {
          ...data,
          registrationType,
          organization: "",
          designation: "",
          industry: "",
          industryOther: "",
          sponsorshipInterest: "",
          sponsorshipDetails: "",
        }
      : { ...data, registrationType };
  });

export type ApplicationInput = z.infer<typeof applicationSchema>;
