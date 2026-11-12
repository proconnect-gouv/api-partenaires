import type { MiddlewareHandler } from "hono";

import type { HttpFailure } from "#src/api/http";
import { log } from "#src/api/log";
import type { VerifyAccessToken } from "#src/api/proconnect";

export type TokenActingUser = {
  readonly auth: "token";
  readonly client_id: string;
  readonly email: string;
  readonly sub: string;
};

export type TokenActingUserEnv = {
  Variables: { acting_user: TokenActingUser };
};

function proconnect_request_failed_fields(failure: HttpFailure) {
  const fields = {
    "error.type": failure.kind,
    event: "proconnect.request.failed",
    "url.full": failure.url,
  } as const;
  switch (failure.kind) {
    case "bad_response":
    case "network":
      return { ...fields, cause: failure.cause };
    case "http_error":
      return { ...fields, "http.response.status_code": failure.http_status };
    case "timeout":
      return fields;
  }
}

export function create_access_token_middleware({
  verify_access_token,
}: {
  verify_access_token: VerifyAccessToken;
}): MiddlewareHandler<TokenActingUserEnv> {
  return async (c, next) => {
    const access_token = /^Bearer (\S+)$/i.exec(
      c.req.header("Authorization") ?? "",
    )?.[1];
    if (!access_token) {
      log("debug", {
        event: "auth.rejected",
        reason: "invalid_authorization_header",
      });
      c.header("WWW-Authenticate", 'Bearer error="invalid_request"');
      return c.json({ detail: "Invalid authorization header" }, 401);
    }

    const verified = await verify_access_token(access_token);
    if (!verified.ok) {
      log("error", proconnect_request_failed_fields(verified.error));
      return c.json({ detail: "Identity provider unavailable" }, 503);
    }
    const verdict = verified.value;
    switch (verdict.kind) {
      case "rejected":
        log("debug", { event: "auth.rejected", reason: verdict.reason });
        c.header("WWW-Authenticate", 'Bearer error="invalid_token"');
        return c.json({ detail: "Invalid token" }, 401);
      case "verified":
        c.set("acting_user", {
          auth: "token",
          client_id: verdict.client_id,
          email: verdict.email,
          sub: verdict.sub,
        });
        await next();
        return;
    }
  };
}
