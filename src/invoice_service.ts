import { z } from "zod";
import { InfraiPdfClient } from "./infrai_pdf_client.ts";

export const invoiceRequestSchema = z.object({
  tenant: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    accountStatus: z.enum(["onboarding", "active", "suspended", "closed"]),
    billingEmail: z.string().email(),
  }),
  order: z.object({
    id: z.string().min(1),
    status: z.enum(["draft", "confirmed", "cancelled"]),
    currency: z.string().length(3),
    items: z.array(z.object({
      description: z.string().min(1),
      quantity: z.number().int().positive(),
      unitAmount: z.number().int().nonnegative(),
    })).min(1),
  }),
});

export type InvoiceRequest = z.infer<typeof invoiceRequestSchema>;

export class InvoiceDecisionError extends Error {
  readonly status = 409;
}

export class InvoiceService {
  private readonly pdfClient: InfraiPdfClient;

  constructor(pdfClient: InfraiPdfClient) {
    this.pdfClient = pdfClient;
  }

  async issue(request: InvoiceRequest): Promise<unknown> {
    if (request.tenant.accountStatus !== "active") {
      throw new InvoiceDecisionError("Tenant account must be active before invoicing");
    }
    if (request.order.status !== "confirmed") {
      throw new InvoiceDecisionError("Order must be confirmed before invoicing");
    }

    const html = renderInvoice(request);
    return this.pdfClient.generatePdf(
      { html, page_size: "A4", orientation: "portrait", store: true },
      `invoice:${request.tenant.id}:${request.order.id}`,
    );
  }
}

function renderInvoice(request: InvoiceRequest): string {
  const rows = request.order.items.map((item) => {
    const lineTotal = item.quantity * item.unitAmount;
    return `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${formatMinor(lineTotal, request.order.currency)}</td></tr>`;
  }).join("");
  const total = request.order.items.reduce(
    (sum, item) => sum + item.quantity * item.unitAmount,
    0,
  );

  return `<!doctype html><html><body><h1>Invoice ${escapeHtml(request.order.id)}</h1><p>${escapeHtml(request.tenant.name)}</p><p>${escapeHtml(request.tenant.billingEmail)}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><strong>${formatMinor(total, request.order.currency)}</strong></body></html>`;
}

function formatMinor(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 100);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] as string);
}
