import { assert_never, err, ok, type Result } from "#src/utils";

export type Fetch = (
  url: string,
  init: RequestInit & {
    redirect: NonNullable<RequestInit["redirect"]>;
    signal: AbortSignal;
  },
) => Promise<Response>;

export type HttpFailure = { readonly url: string } & (
  | { readonly cause: unknown; readonly kind: "bad_response" }
  | { readonly http_status: number; readonly kind: "http_error" }
  | { readonly cause: unknown; readonly kind: "request_failed" }
  | { readonly kind: "timeout" }
);

function exception_fields(cause: unknown) {
  if (cause instanceof Error)
    return {
      "exception.message": cause.message,
      "exception.type": cause.name,
    };
  return {
    "exception.message": "non-error thrown",
    "exception.type": typeof cause,
  };
}

export function http_failure_fields(failure: HttpFailure) {
  const fields = {
    "error.type": failure.kind,
    "url.full": failure.url,
  } as const;
  switch (failure.kind) {
    case "bad_response":
    case "request_failed":
      return { ...fields, ...exception_fields(failure.cause) };
    case "http_error":
      return { ...fields, "http.response.status_code": failure.http_status };
    case "timeout":
      return fields;
    default:
      return assert_never(failure);
  }
}

export async function safe_fetch({
  fetch,
  init,
  url,
}: {
  fetch: Fetch;
  init: Parameters<Fetch>[1];
  url: string;
}): Promise<Result<Response, HttpFailure>> {
  try {
    return ok(await fetch(url, init));
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError")
      return err({ kind: "timeout", url });
    return err({ cause, kind: "request_failed", url });
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
