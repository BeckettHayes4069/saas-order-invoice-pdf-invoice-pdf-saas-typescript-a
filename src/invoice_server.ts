import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError, InfraiPdfClient } from "./infrai_pdf_client.ts";
import { InvoiceDecisionError, InvoiceService, invoiceRequestSchema } from "./invoice_service.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the invoice service");

const service = new InvoiceService(new InfraiPdfClient(apiKey));
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/invoices") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = invoiceRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const pdf = await service.issue(input);
    send(response, 201, { orderId: input.order.id, invoice: pdf });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid invoice request" });
    } else if (error instanceof InvoiceDecisionError) {
      send(response, error.status, { error: error.message });
    } else if (error instanceof InfraiError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
      });
    } else {
      send(response, 502, { error: "Invoice generation failed" });
    }
  }
}).listen(port, () => {
  console.log(`Invoice service listening on http://localhost:${port}`);
});

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
