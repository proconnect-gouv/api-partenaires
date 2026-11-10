import { z } from "zod";

import { type Email, email_schema } from "#src/api/email";
import {
  type Fetch,
  type HttpFailure,
  read_response_body,
  safe_fetch,
} from "#src/api/http";
import { err, ok, type Result } from "#src/utils";

const TIMEOUT_MS = 5_000;

function issuer_schema(protocol: RegExp) {
  return z
    .url({ protocol })
    .refine(
      (url) => {
        const { hash, password, search, username } = new URL(url);
        return !hash && !password && !search && !username;
      },
      { message: "Expected an issuer without credentials, query or fragment" },
    )
    .transform((url) => url.replace(/\/+$/, ""))
    .brand<"ProconnectIssuer">();
}

export const https_issuer_schema = issuer_schema(/^https$/);
export const http_or_https_issuer_schema = issuer_schema(/^https?$/);
export type ProconnectIssuer = z.infer<typeof https_issuer_schema>;

const introspection_schema = z.object({
  active: z.boolean(),
  client_id: z.string().optional(),
  sub: z.string().optional(),
  token_type: z.string().optional(),
});
const userinfo_schema = z.object({
  email: email_schema.optional(),
  sub: z.string().optional(),
});

export type AccessTokenVerdict =
  | {
      readonly kind: "verified";
      readonly client_id: string;
      readonly email: Email;
      readonly sub: string;
    }
  | {
      readonly kind: "rejected";
      readonly reason:
        | "token_client_mismatch"
        | "token_email_missing"
        | "token_inactive"
        | "token_scope_insufficient"
        | "token_subject_mismatch"
        | "token_subject_missing"
        | "token_type_mismatch";
    };

export type VerifyAccessToken = (
  access_token: string,
) => Promise<Result<AccessTokenVerdict, HttpFailure>>;

// Userinfo may come back as a signed JWT; its claims are read without checking the
// signature because the response comes straight from the issuer over TLS.
function parse_userinfo_body(body: string): unknown {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const segments = trimmed.split(".");
  if (segments.length !== 3)
    throw new Error("Expected a JSON object or a signed JWT");
  const [, payload = ""] = segments;
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

export function create_verify_access_token({
  allowed_client_id,
  client_id,
  client_secret,
  fetch,
  issuer,
}: {
  allowed_client_id: string;
  client_id: string;
  client_secret: string;
  fetch: Fetch;
  issuer: ProconnectIssuer;
}): VerifyAccessToken {
  const introspection_url = `${issuer}/token/introspection`;
  const userinfo_url = `${issuer}/userinfo`;
  return async function verify_access_token(access_token) {
    const introspection_response = await safe_fetch({
      fetch,
      init: {
        body: new URLSearchParams({
          client_id,
          client_secret,
          token: access_token,
        }),
        headers: { accept: "application/json" },
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      url: introspection_url,
    });
    if (!introspection_response.ok) return introspection_response;
    const introspection_body = await read_response_body({
      parse: JSON.parse,
      response: introspection_response.value,
      url: introspection_url,
    });
    if (!introspection_body.ok) return introspection_body;
    const introspection = introspection_schema.safeParse(
      introspection_body.value,
    );
    if (!introspection.success)
      return err({
        cause: introspection.error,
        kind: "bad_response",
        url: introspection_url,
      });
    const {
      active,
      client_id: token_client_id,
      sub,
      token_type,
    } = introspection.data;
    if (!active) return ok({ kind: "rejected", reason: "token_inactive" });
    if (token_client_id !== allowed_client_id)
      return ok({ kind: "rejected", reason: "token_client_mismatch" });
    if (token_type !== "Bearer")
      return ok({ kind: "rejected", reason: "token_type_mismatch" });
    if (!sub) return ok({ kind: "rejected", reason: "token_subject_missing" });

    const userinfo_response = await safe_fetch({
      fetch,
      init: {
        headers: { authorization: `Bearer ${access_token}` },
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      url: userinfo_url,
    });
    if (!userinfo_response.ok) return userinfo_response;
    switch (userinfo_response.value.status) {
      // The federation session can end between introspection and userinfo.
      case 401:
        return ok({ kind: "rejected", reason: "token_inactive" });
      case 403:
        return ok({ kind: "rejected", reason: "token_scope_insufficient" });
    }
    const userinfo_body = await read_response_body({
      parse: parse_userinfo_body,
      response: userinfo_response.value,
      url: userinfo_url,
    });
    if (!userinfo_body.ok) return userinfo_body;
    const userinfo = userinfo_schema.safeParse(userinfo_body.value);
    if (!userinfo.success || userinfo.data.email === undefined)
      return ok({ kind: "rejected", reason: "token_email_missing" });
    if (userinfo.data.sub !== sub)
      return ok({ kind: "rejected", reason: "token_subject_mismatch" });
    return ok({
      kind: "verified",
      client_id: token_client_id,
      email: userinfo.data.email,
      sub,
    });
  };
}
