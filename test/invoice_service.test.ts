import assert from "node:assert/strict";
import test from "node:test";
import { InfraiPdfClient, type HttpTransport } from "../src/infrai_pdf_client.ts";
import { InvoiceDecisionError, InvoiceService, type InvoiceRequest } from "../src/invoice_service.ts";

const confirmedOrder: InvoiceRequest = {
  tenant: {
    id: "tenant_acme",
    name: "Acme Systems",
    accountStatus: "active",
    billingEmail: "billing@example.com",
  },
  order: {
    id: "order_1042",
    status: "confirmed",
    currency: "USD",
    items: [{ description: "Team seats", quantity: 3, unitAmount: 2500 }],
  },
};

test("issues one stored PDF for an active tenant and confirmed order", async () => {
  let captured: RequestInit | undefined;
  const transport: HttpTransport = async (_url, init) => {
    captured = init;
    return new Response(JSON.stringify({ ok: true, data: { job_id: "job_42" }, metadata: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const service = new InvoiceService(new InfraiPdfClient("test-key", transport));

  const result = await service.issue(confirmedOrder);

  assert.deepEqual(result, { job_id: "job_42" });
  assert.equal(captured?.method, "POST");
  assert.equal((captured?.headers as Record<string, string>)["Idempotency-Key"], "invoice:tenant_acme:order_1042");
  const body = JSON.parse(captured?.body as string);
  assert.deepEqual(
    { page_size: body.page_size, orientation: body.orientation, store: body.store },
    { page_size: "A4", orientation: "portrait", store: true },
  );
  assert.match(body.html, /Team seats/);
  assert.match(body.html, /\$75\.00/);
});

test("rejects a suspended tenant before calling PDF generation", async () => {
  let calls = 0;
  const transport: HttpTransport = async () => {
    calls += 1;
    return new Response(JSON.stringify({ ok: true, data: {} }));
  };
  const service = new InvoiceService(new InfraiPdfClient("test-key", transport));
  const request = {
    ...confirmedOrder,
    tenant: { ...confirmedOrder.tenant, accountStatus: "suspended" as const },
  };

  await assert.rejects(() => service.issue(request), InvoiceDecisionError);
  assert.equal(calls, 0);
});
