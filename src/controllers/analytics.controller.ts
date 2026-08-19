import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

import { db } from "../config/firebase.js";

type UnknownRecord = Record<string, unknown>;

const PAID_STATUSES = new Set(["SUCCESS", "PARTIALLY_REFUNDED", "REFUNDED"]);

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function text(value: unknown, fallback = "-"): string {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function number(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") return toDate.call(value) as Date;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function istDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function previousMonthKey(currentMonth: string): string {
  const [year = 1970, month = 1] = currentMonth.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 2, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function authorized(request: Request): boolean {
  const expected = process.env.ANALYTICS_API_KEY?.trim();
  const provided = request.header("x-analytics-key")?.trim();
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function breakdown(map: Map<string, number>) {
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function analyticsOverview(request: Request, response: Response) {
  if (!process.env.ANALYTICS_API_KEY?.trim()) {
    return response.status(503).json({ success: false, message: "Analytics access is not configured" });
  }
  if (!authorized(request)) {
    return response.status(401).json({ success: false, message: "Invalid analytics access key" });
  }

  const page = Math.max(1, Math.floor(number(request.query.page) || 1));
  const pageSize = Math.min(100, Math.max(10, Math.floor(number(request.query.pageSize) || 20)));
  const search = text(request.query.search, "").toLowerCase();
  const statusFilter = text(request.query.status, "ALL").toUpperCase();

  try {
    const snapshot = await db.collection("summitApplications").get();
    const now = new Date();
    const todayKey = istDateKey(now);
    const yesterdayKey = istDateKey(new Date(now.getTime() - 86_400_000));
    const currentMonthKey = todayKey.slice(0, 7);
    const lastMonthKey = previousMonthKey(currentMonthKey);
    const firstTrendDate = new Date(now.getTime() - 29 * 86_400_000);

    const statusCounts = new Map<string, number>();
    const registrationTypeCounts = new Map<string, number>();
    const industryCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    const daily = new Map<string, { registrations: number; revenue: number }>();

    for (let offset = 29; offset >= 0; offset -= 1) {
      daily.set(istDateKey(new Date(now.getTime() - offset * 86_400_000)), { registrations: 0, revenue: 0 });
    }

    let paidRegistrations = 0;
    let totalPaid = 0;
    let totalRevenue = 0;
    let totalRefunded = 0;
    let todayRegistrations = 0;
    let yesterdayRegistrations = 0;
    let currentMonthRegistrations = 0;
    let lastMonthRegistrations = 0;

    const rows = snapshot.docs.map((document) => {
      const data = document.data();
      const applicant = record(data.applicant);
      const payment = record(data.payment);
      const pricing = record(data.pricing);
      const status = text(payment.status ?? data.paymentStatus, "UNKNOWN").toUpperCase();
      const isPaid = PAID_STATUSES.has(status);
      const createdAt = dateValue(data.createdAt);
      const verifiedAt = dateValue(data.verifiedAt);
      const registeredAt = verifiedAt ?? createdAt;
      const paidAmount = isPaid ? number(payment.paidAmount ?? pricing.totalAmount) : 0;
      const refundedAmount = number(payment.refundedAmount);
      const revenue = Math.max(0, paidAmount - refundedAmount);
      const registrationType = text(applicant.registrationType ?? data.registrationType);
      const industry = text(applicant.industry ?? data.industry);
      const country = text(applicant.country ?? data.country);
      const dateKey = registeredAt ? istDateKey(registeredAt) : "";

      increment(statusCounts, status);
      if (isPaid) {
        paidRegistrations += 1;
        totalPaid += paidAmount;
        totalRevenue += revenue;
        totalRefunded += refundedAmount;
        increment(registrationTypeCounts, registrationType);
        increment(industryCounts, industry);
        increment(countryCounts, country);
        if (dateKey === todayKey) todayRegistrations += 1;
        if (dateKey === yesterdayKey) yesterdayRegistrations += 1;
        if (dateKey.startsWith(currentMonthKey)) currentMonthRegistrations += 1;
        if (dateKey.startsWith(lastMonthKey)) lastMonthRegistrations += 1;
        const trend = daily.get(dateKey);
        if (trend && registeredAt && registeredAt >= firstTrendDate) {
          trend.registrations += 1;
          trend.revenue += revenue;
        }
      }

      return {
        id: document.id,
        orderId: text(data.orderId, document.id),
        createdAt: createdAt?.toISOString() ?? null,
        verifiedAt: verifiedAt?.toISOString() ?? null,
        applicant: {
          registrationType,
          name: text(applicant.name ?? data.name),
          email: text(applicant.email ?? data.email),
          phone: text(applicant.phone ?? data.phone),
          chapterName: text(applicant.chapterName ?? data.chapterName),
          organization: text(applicant.organization ?? data.organization),
          designation: text(applicant.designation ?? data.designation),
          industry,
          industryOther: text(applicant.industryOther ?? data.industryOther),
          sponsorshipInterest: text(applicant.sponsorshipInterest ?? data.sponsorshipInterest),
          sponsorshipDetails: text(applicant.sponsorshipDetails ?? data.sponsorshipDetails),
          dietaryRestrictions: Array.isArray(applicant.dietaryRestrictions)
            ? applicant.dietaryRestrictions.map((item) => text(item)).join(", ")
            : text(data.dietaryRestrictions),
          dietaryOther: text(applicant.dietaryOther ?? data.dietaryOther),
          address1: text(applicant.address1 ?? data.address1),
          address2: text(applicant.address2 ?? data.address2),
          city: text(applicant.city ?? data.city),
          stateProvince: text(applicant.stateProvince ?? data.stateProvince),
          postalCode: text(applicant.postalCode ?? data.postalCode),
          address: [
            applicant.address1 ?? data.address1,
            applicant.address2 ?? data.address2,
            applicant.city ?? data.city,
            applicant.stateProvince ?? data.stateProvince,
            applicant.postalCode ?? data.postalCode,
            applicant.country ?? data.country,
          ].map((item) => text(item, "")).filter(Boolean).join(", ") || "-",
          country,
          vatGstNumber: text(applicant.vatGstNumber ?? data.vatGstNumber),
          intent: text(applicant.intent ?? data.intent),
        },
        payment: {
          status,
          paidAmount,
          refundedAmount,
          netRevenue: revenue,
          currency: text(pricing.currency, "INR"),
          method: text(payment.paymentMethod),
          transactionId: text(payment.transactionId),
          expectedAmount: number(payment.expectedAmount ?? pricing.totalAmount),
          baseAmount: number(pricing.baseAmount),
          gstRate: number(pricing.gstRate),
          gstAmount: number(pricing.gstAmount),
        },
      };
    });

    rows.sort((a, b) => Date.parse(b.verifiedAt ?? b.createdAt ?? "1970-01-01") - Date.parse(a.verifiedAt ?? a.createdAt ?? "1970-01-01"));

    const filteredRows = rows.filter((row) => {
      const statusMatches = statusFilter === "ALL" || row.payment.status === statusFilter;
      const searchMatches = !search || [
        row.orderId, row.applicant.name, row.applicant.email, row.applicant.phone,
        row.applicant.organization, row.payment.transactionId,
      ].some((value) => value.toLowerCase().includes(search));
      return statusMatches && searchMatches;
    });

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return response.status(200).json({
      success: true,
      generatedAt: now.toISOString(),
      timezone: "Asia/Kolkata",
      metrics: {
        totalApplications: rows.length,
        totalRegistrations: paidRegistrations,
        totalPaid,
        totalRevenue,
        totalRefunded,
        averageRevenuePerRegistration: paidRegistrations ? totalRevenue / paidRegistrations : 0,
        todayRegistrations,
        yesterdayRegistrations,
        currentMonthRegistrations,
        lastMonthRegistrations,
        conversionRate: rows.length ? (paidRegistrations / rows.length) * 100 : 0,
      },
      trends: [...daily.entries()].map(([date, values]) => ({ date, ...values })),
      breakdowns: {
        paymentStatus: breakdown(statusCounts),
        registrationType: breakdown(registrationTypeCounts),
        industry: breakdown(industryCounts),
        country: breakdown(countryCounts),
      },
      table: {
        rows: filteredRows.slice(start, start + pageSize),
        pagination: { page: safePage, pageSize, totalRecords: filteredRows.length, totalPages },
      },
    });
  } catch (error) {
    console.error("Unable to build analytics dashboard", error);
    return response.status(500).json({ success: false, message: "Unable to retrieve analytics" });
  }
}
