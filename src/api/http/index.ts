import { err, ok, type Result } from "#src/utils";

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type HttpFailure = { readonly url: string } & (
  | { readonly cause: unknown; readonly kind: "bad_response" }
  | { readonly http_status: number; readonly kind: "http_error" }
  | { readonly cause: unknown; readonly kind: "network" }
  | { readonly kind: "timeout" }
);

export async function safe_fetch({
  fetch,
  init,
  timeout_ms,
  url,
}: {
  fetch: Fetch;
  init: RequestInit;
  timeout_ms: number;
  url: string;
}): Promise<Result<Response, HttpFailure>> {
  try {
    return ok(
      await fetch(url, { ...init, signal: AbortSignal.timeout(timeout_ms) }),
    );
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError")
      return err({ kind: "timeout", url });
    return err({ cause, kind: "network", url });
  }
}

export async function read_response_body({
  parse,
  response,
  url,
}: {
  parse: (body: string) => unknown;
  response: Response;
  url: string;
}): Promise<Result<unknown, HttpFailure>> {
  if (!response.ok)
    return err({ http_status: response.status, kind: "http_error", url });
  try {
    return ok(parse(await response.text()));
  } catch (cause) {
    return err({ cause, kind: "bad_response", url });
  }
}
