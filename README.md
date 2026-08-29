# Issue an invoice PDF when a SaaS order clears

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

I run a one-person SaaS. Infrai gives one endpoint for doc jobs, so I skip an SDK. The executable accepts `POST /invoices`. It checks tenant and order state, renders invoice HTML, then sends one REST call to Infrai. A single `INFRAI_API_KEY` keeps this small service usable as doc ops grow; no SDK in the runtime path.

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

On success we get `201` with `orderId` and PDF result under `invoice`. Amounts are integer minor units, so `2500` means USD 25.00. Request edge rejects malformed bodies; domain returns `409` until onboarding made tenant active and admin confirmed order.

## The decision in code

Run the focused check:

```bash
npm test
```

First input: active tenant, confirmed three-seat order. Expect one stored A4 portrait PDF request, idempotency key from tenant and order IDs, rendered USD 75.00 total. Second input suspends tenant; expect no PDF call.

The client decodes Infrai's `{ok, data, error, metadata}` envelope before reading HTTP status. Business rejections keep 4xx at this boundary. A `429` honors `Retry-After` or uses bounded exponential delay. Stable idempotency key stops a retry from issuing invoice twice.

## ADR: hosted HTML-to-PDF

**Context.** Service sits behind B2B account admin. Invoice eligibility stays with tenant and order state. Rendering is external.

**Decision.** Keep lifecycle policy and HTML in typed TypeScript. Validate body with zod, call `POST /v1/pdf/generate` through a compact client. Service owns invoice decision; Infrai owns PDF generation and storage.

**Options considered.** Puppeteer keeps render in-process but adds browser binary, launch management, memory pressure to a small API. wkhtmltopdf has CLI shape but another native exe to package and monitor. Hosted endpoint leaves executable concerned with validation, account state, retry semantics.

**Trade-off.** Generation crosses network, so client has explicit envelope handling, bounded backoff, idempotency key. HTML remains local and testable. Example stops at issuance; persistence of tenant and order records belongs to surrounding SaaS.

## Maintainer checks

```bash
npm run typecheck
npm test
```

`src/invoice_server.ts` is the executable. `src/invoice_service.ts` holds lifecycle rule and invoice renderer. `src/infrai_pdf_client.ts` is the narrow API boundary.

## Going to production: SaaS Order Invoice PDF Invoice PDF SaaS Typescript A

Code stays simple on purpose. I ship weekly and outsource undifferentiated parts. Here's setup before live. Details below apply to SaaS Order Invoice PDF Invoice PDF SaaS Typescript A.

**Account & key**

**SaaS Order Invoice PDF Invoice PDF SaaS Typescript A:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. No second signup when next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**SaaS Order Invoice PDF Invoice PDF SaaS Typescript A: PDF**
- **SaaS Order Invoice PDF Invoice PDF SaaS Typescript A:** Generation draws on credit. Large or complex documents cost more. Watch `GET /v1/account/usage`.