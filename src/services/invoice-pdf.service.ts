import PDFDocument from "pdfkit";

export type InvoicePdfInput = {
  invoiceNumber: string;
  invoiceDate?: Date;
  applicantName: string;
  applicantEmail: string;
  phone?: string;
  organization?: string;
  address1?: string;
  address2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  vatGstNumber?: string;
  orderId: string;
  transactionId: string;
  baseAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  currency: string;
};

const COLORS = {
  ink: "#191815",
  muted: "#6f6a60",
  gold: "#b4934f",
  paleGold: "#f4efe3",
  line: "#d7c9aa",
  white: "#ffffff",
};

function value(input: string | undefined): string {
  return input?.trim() || "-";
}

function money(amount: number, currency: string): string {
  return `${currency.toUpperCase()} ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function invoiceDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function writePair(doc: PDFKit.PDFDocument, label: string, content: string, y: number): void {
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(label.toUpperCase(), 54, y, { width: 145 });
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.ink).text(content, 200, y - 1, { width: 335, align: "right" });
  doc.moveTo(54, y + 17).lineTo(541, y + 17).lineWidth(0.5).strokeColor(COLORS.line).stroke();
}

export async function createInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const splitTaxRate = input.gstRate / 2;
  const splitTaxAmount = input.gstAmount / 2;
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `ILS Invoice ${input.invoiceNumber}`, Author: "Ascent Sphere LLP" } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.rect(0, 0, 595.28, 841.89).fill(COLORS.white);
  doc.rect(0, 0, 595.28, 12).fill(COLORS.gold);
  doc.font("Times-Bold").fontSize(19).fillColor(COLORS.ink).text("INDIA LEADERSHIP\nSUMMIT", 54, 43, { width: 285, lineGap: 1 });
  doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.gold).text("2026  |  HYDERABAD  |  REGISTRATION INVOICE", 55, 91, { characterSpacing: 0.8 });

  doc.roundedRect(366, 42, 175, 64, 3).fill(COLORS.paleGold);
  doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text("INVOICE NUMBER", 382, 56);
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.ink).text(input.invoiceNumber, 382, 70, { width: 143 });
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(invoiceDate(input.invoiceDate ?? new Date()), 382, 91);

  doc.moveTo(54, 126).lineTo(541, 126).lineWidth(1).strokeColor(COLORS.gold).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("ISSUED BY", 54, 145);
  doc.font("Helvetica-Bold").fontSize(12).text("M/S ASCENT SPHERE LLP", 54, 164);
  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text("Ground Floor Part, 6-3-788/37, Badhe House\nAmeerpet Road, Ameerpet, Hyderabad\nHyderabad, Telangana - 500016", 54, 183, { lineGap: 3 });
  doc.font("Helvetica-Bold").fillColor(COLORS.ink).text("GST: 36ACCFA2996D1ZG", 54, 231).text("PAN: ACCFA2996D", 54, 246);

  doc.font("Helvetica-Bold").fontSize(10).text("BILLED TO", 316, 145);
  doc.font("Helvetica-Bold").fontSize(12).text(value(input.applicantName), 316, 164, { width: 225 });
  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(value(input.organization), 316, 183, { width: 225 });
  const address = [input.address1, input.address2, input.city, input.stateProvince, input.postalCode, input.country].filter((part) => part?.trim()).join(", ");
  doc.text(value(address), 316, 199, { width: 225, lineGap: 2 });
  doc.text(value(input.applicantEmail), 316, 229, { width: 225 }).text(value(input.phone), 316, 244, { width: 225 });
  doc.font("Helvetica-Bold").fillColor(COLORS.ink).text(`GST: ${input.vatGstNumber?.trim() ?? ""}`, 316, 259, { width: 225 });

  doc.roundedRect(54, 294, 487, 37, 2).fill(COLORS.ink);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.white)
    .text("DESCRIPTION", 69, 309).text("HSN", 342, 309).text("QTY", 405, 309).text("AMOUNT", 465, 309);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("ILS 2026 Registration Fee", 69, 351);
  doc.font("Helvetica").fontSize(9).text("998596", 342, 351).text("1", 411, 351).text(money(input.baseAmount, input.currency), 442, 351, { width: 84, align: "right" });
  doc.moveTo(54, 380).lineTo(541, 380).lineWidth(0.7).strokeColor(COLORS.line).stroke();

  writePair(doc, "Total taxable", money(input.baseAmount, input.currency), 406);
  writePair(doc, `CGST (${splitTaxRate}%)`, money(splitTaxAmount, input.currency), 438);
  writePair(doc, `SGST (${splitTaxRate}%)`, money(splitTaxAmount, input.currency), 470);
  doc.roundedRect(54, 505, 487, 52, 3).fill(COLORS.paleGold);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("TOTAL AMOUNT PAID", 70, 526);
  doc.font("Times-Bold").fontSize(19).fillColor(COLORS.gold).text(money(input.totalAmount, input.currency), 315, 520, { width: 210, align: "right" });

  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink).text("PAYMENT REFERENCE", 54, 589);
  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted)
    .text(`Registration ID: ${input.orderId}`, 54, 608)
    .text(`Transaction ID: ${input.transactionId}`, 54, 624);

  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink).text("BANK DETAILS", 316, 589);
  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted)
    .text("Account: ASCENT SPHERE LLP", 316, 608)
    .text("A/C: 50200121249326  |  IFSC: HDFC0003947", 316, 624)
    .text("Branch: Jayabheri Enclave, Hyderabad - 500084", 316, 640, { width: 225 });

  doc.moveTo(54, 688).lineTo(541, 688).lineWidth(0.7).strokeColor(COLORS.line).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text("For invoice queries: Veena S  |  +91 9063740066  |  finance@corporateconnections-india.com", 54, 707, { width: 487, align: "center" });
  doc.text("This is a computer-generated invoice and does not require a signature.", 54, 726, { width: 487, align: "center" });
  doc.font("Times-Bold").fontSize(14).fillColor(COLORS.gold).text("THANK YOU", 54, 764, { width: 487, align: "center" });
  doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted).text("CorporateConnections AP&TS  |  C/O Ascent Sphere LLP", 54, 791, { width: 487, align: "center" });

  doc.end();
  return complete;
}
