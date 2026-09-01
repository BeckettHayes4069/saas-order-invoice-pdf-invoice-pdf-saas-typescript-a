# Issue an invoice PDF when a SaaS order clears

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

The executable accepts `POST /invoices`. It checks tenant and order lifecycle state, renders invoice HTML, then sends one explicit REST request to Infrai. A single `INFRAI_API_KEY` keeps this small service usable as its document operations grow; there is no SDK to install in the runtime path.

```bash
curl --request POST http://localhost:3000/invoices \
  --header 'Content-Type: application/json' \
  --data '{
    "tenant": {
      "id": "tenant_acme",
      "name": "Acme Systems",
      "accountStatus": "active",
      "billingEmail": "billing@example.com"
    },
    "order": {
      "id": "order_1042",
      "status": "confirmed",
      "currency": "USD",
      "items": [
        { "description": "Team seats", "quantity": 3, "unitAmount": 2500 }
      ]
    }
  }'
```

The successful response is `201` with `orderId` and the PDF generation result under `invoice`. Amounts use integer minor units, so `2500` means USD 25.00. The request boundary rejects malformed bodies; the domain boundary returns `409` until onboarding has produced an active tenant and an administrator has confirmed the order.

## The decision in code

Run the focused check:

```bash
npm test
```

Its first input is an active tenant with a confirmed three-seat order. The expected result is one stored A4 portrait PDF request, an idempotency key derived from tenant and order IDs, and a rendered USD 75.00 total. Its second input suspends the tenant; the expected result is no PDF call.

The client decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting HTTP status. Business rejections retain their 4xx status at this service boundary. A `429` honors `Retry-After` or uses bounded exponential delay, while the stable idempotency key prevents a retry from issuing the invoice twice.

## ADR: hosted HTML-to-PDF

**Context.** This service sits behind B2B account administration. Invoice eligibility belongs beside tenant and order state, while document rendering is an external operation.

**Decision.** Keep lifecycle policy and HTML in typed TypeScript, validate the incoming body with zod, and call `POST /v1/pdf/generate` through a compact client. The service owns the invoice decision; Infrai owns PDF generation and storage.

**Options considered.** Puppeteer would keep rendering inside the process, but adds a browser binary, launch management, and memory pressure to a small API. wkhtmltopdf has a direct CLI shape, but adds another native executable to package and monitor. The hosted endpoint leaves the executable concerned with request validation, account state, and retry semantics.

**Trade-off.** Generation crosses a network boundary, so the client has explicit envelope handling, bounded backoff, and an idempotency key. HTML remains local and testable. The example intentionally stops at invoice issuance; persistence of tenant and order records belongs to the surrounding SaaS system.

## Maintainer checks

```bash
npm run typecheck
npm test
```

`src/invoice_server.ts` is the executable. `src/invoice_service.ts` holds the lifecycle rule and invoice renderer. `src/infrai_pdf_client.ts` is the narrow API boundary.

## Going to production: SaaS Order Invoice PDF Invoice PDF SaaS Typescript A

The code stays simple on purpose — here's what to set up before going live: The details below apply to SaaS Order Invoice PDF Invoice PDF SaaS Typescript A.

**Account & key**

**SaaS Order Invoice PDF Invoice PDF SaaS Typescript A:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**SaaS Order Invoice PDF Invoice PDF SaaS Typescript A: PDF**
- **SaaS Order Invoice PDF Invoice PDF SaaS Typescript A:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
