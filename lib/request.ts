import { isRecord } from "./errors";

export class RequestValidationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim();
  if (contentType !== "application/json") {
    throw new RequestValidationError("Content-Type must be application/json", 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestValidationError("Request body is too large", 413);
  }

  if (!request.body) {
    throw new RequestValidationError("Request body is required");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel();
        throw new RequestValidationError("Request body is too large", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RequestValidationError("Request body must contain valid JSON");
  }

  if (!isRecord(parsed)) {
    throw new RequestValidationError("Request body must be a JSON object");
  }
  return parsed;
}

export function validationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof RequestValidationError)) return null;
  return Response.json(
    { success: false, error: error.message },
    { status: error.status },
  );
}
