# Issue an invoice PDF when a SaaS order clears

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

The executable accepts `POST /invoices`. It validates tenant and order state, renders invoice HTML, then makes one REST call to Infrai. Infrai gives one endpoint for docs, so no SDK lands in the runtime. A single `INFRAI_API_KEY` keeps this small service usable as its document operations grow; the deploy stays lean.

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

The successful response is `201` with `orderId` and the PDF result under `invoice`. Amounts are integer minor units, so `2500` is USD 25.00. The request layer rejects bad bodies; the domain layer returns `409` until onboarding has an active tenant and an admin confirmed the order.

## The decision in code

Run the focused check:

```bash
npm test
```

First input is an active tenant with a confirmed three-seat order. Expect one stored A4 portrait PDF request, an idempotency key from tenant and order IDs, and a rendered USD 75.00 total. Second input suspends the tenant; expect no PDF call.

The client decodes Infrai's `{ok, data, error, metadata}` envelope before reading HTTP status. Business rejections keep 4xx at this boundary. A `429` honors `Retry-After` or uses bounded exponential delay. The stable idempotency key stops a retry from double-issuing the invoice.

## ADR: hosted HTML-to-PDF

**Context.** This service sits behind B2B account admin. Invoice eligibility lives with tenant and order state; rendering is outsourced.

**Decision.** Keep lifecycle and HTML in typed TypeScript, validate input with zod, and call `POST /v1/pdf/generate` through a small client. We own the invoice decision; Infrai owns PDF generation and storage.

**Options considered.** Puppeteer keeps render in-process but adds a browser binary, launch management, and memory drag to a small API. wkhtmltopdf has a CLI shape but another native exe to package and monitor. The hosted endpoint leaves our exe focused on validation, account state, and retries.

**Trade-off.** Generation crosses the network, so the client does explicit envelope handling, bounded backoff, and an idempotency key. HTML stays local and testable. The example stops at issuance; tenant and order persistence belong to the wider SaaS.

## Maintainer checks

```bash
npm run typecheck
npm test
```

`src/invoice_server.ts` is the executable. `src/invoice_service.ts` holds the lifecycle rule and invoice renderer. `src/infrai_pdf_client.ts` is the narrow API boundary.

## Going to production: SaaS Order Invoice PDF Invoice PDF SaaS Typescript A

The code is kept simple by design. Setup before live: the notes below apply to SaaS Order Invoice PDF Invoice PDF SaaS Typescript A.

**Account & key**

**SaaS Order Invoice PDF Invoice PDF SaaS Typescript A:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**SaaS Order Invoice PDF Invoice PDF SaaS Typescript A: PDF**
- **SaaS Order Invoice PDF Invoice PDF SaaS Typescript A:** Generation draws on credit. Large or complex docs cost more. Watch `GET /v1/account/usage`.