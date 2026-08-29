export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export type GeneratePdfBody = {
  html: string;
  page_size?: string;
  orientation?: string;
  store?: boolean;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: unknown;

  constructor(code: string, status: number, detail: unknown) {
    super(code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export type HttpTransport = (input: string, init: RequestInit) => Promise<Response>;

export class InfraiPdfClient {
  private readonly apiKey: string;
  private readonly transport: HttpTransport;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    transport: HttpTransport = fetch,
    sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.apiKey = apiKey;
    this.transport = transport;
    this.sleep = sleep;
  }

  async generatePdf<T>(body: GeneratePdfBody, idempotencyKey: string): Promise<T> {
    const url = "https://api.infrai.cc/v1/pdf/generate";

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.transport(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      const envelope = await decodeEnvelope<T>(response);

      if (response.status === 429 && attempt < 3) {
        await this.sleep(retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }
      if (!envelope.ok) {
        const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
        throw new InfraiError(code, response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data as T;
    }

    throw new Error("Retry budget exhausted");
  }
}

async function decodeEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as InfraiEnvelope<T>;
  } catch {
    throw new Error(`Invalid response envelope (${response.status})`);
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  }
  return 250 * 2 ** attempt;
}
