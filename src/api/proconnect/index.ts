import * as client from "openid-client";
import { z } from "zod";

import { type Email, email_schema } from "#src/api/email";
import { http_failure_fields, type HttpFailure } from "#src/api/http";
import { log } from "#src/api/log";
import { assert_never, err, ok, type Result } from "#src/utils";

const TIMEOUT_S = 5;

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

const server_metadata_schema = z.object({
  introspection_endpoint: z.url(),
  userinfo_endpoint: z.url(),
});
const introspection_schema = z.object({
  active: z.boolean(),
  client_id: z.string().optional(),
  sub: z.string().optional(),
  token_type: z.string().optional(),
});
const userinfo_schema = z.object({
  email: email_schema.optional(),
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

type ResourceServer = {
  allow_http_issuer: boolean;
  allowed_client_ids: readonly string[];
  client_id: string;
  client_secret: string;
  fetch: client.CustomFetch;
  issuer: ProconnectIssuer;
};

type Federation = {
  readonly introspection: {
    readonly config: client.Configuration;
    readonly url: string;
  };
  readonly userinfo: {
    readonly configs: ReadonlyMap<string, client.Configuration>;
    readonly url: string;
  };
};

function judge_introspection({
  introspection: { active, client_id, sub, token_type },
  userinfo_configs,
}: {
  introspection: z.infer<typeof introspection_schema>;
  userinfo_configs: ReadonlyMap<string, client.Configuration>;
}) {
  if (!active) return { kind: "rejected", reason: "token_inactive" } as const;
  const userinfo_config =
    client_id === undefined ? undefined : userinfo_configs.get(client_id);
  if (client_id === undefined || userinfo_config === undefined)
    return { kind: "rejected", reason: "token_client_mismatch" } as const;
  if (token_type !== "Bearer")
    return { kind: "rejected", reason: "token_type_mismatch" } as const;
  if (!sub)
    return { kind: "rejected", reason: "token_subject_missing" } as const;
  return { kind: "active", client_id, sub, userinfo_config } as const;
}

function judge_userinfo({
  token,
  userinfo,
}: {
  token: Extract<ReturnType<typeof judge_introspection>, { kind: "active" }>;
  userinfo: Result<unknown, HttpFailure>;
}): Result<AccessTokenVerdict, HttpFailure> {
  if (!userinfo.ok) {
    const failure = userinfo.error;
    switch (failure.kind) {
      case "bad_response":
        if (
          failure.cause instanceof client.ClientError &&
          failure.cause.code === "OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED"
        )
          return ok({ kind: "rejected", reason: "token_subject_mismatch" });
        return userinfo;
      case "http_error":
        switch (failure.http_status) {
          // The federation session can end between introspection and userinfo.
          case 401:
            return ok({ kind: "rejected", reason: "token_inactive" });
          case 403:
            return ok({ kind: "rejected", reason: "token_scope_insufficient" });
        }
        return userinfo;
      case "request_failed":
      case "timeout":
        return userinfo;
      default:
        return assert_never(failure);
    }
  }
  const claims = userinfo_schema.safeParse(userinfo.value);
  if (!claims.success || claims.data.email === undefined)
    return ok({ kind: "rejected", reason: "token_email_missing" });
  return ok({
    kind: "verified",
    client_id: token.client_id,
    email: claims.data.email,
    sub: token.sub,
  });
}

function federation_failure({
  cause,
  url,
}: {
  cause: unknown;
  url: string;
}): HttpFailure {
  if (
    cause instanceof client.ResponseBodyError ||
    cause instanceof client.WWWAuthenticateChallengeError
  )
    return { http_status: cause.status, kind: "http_error", url };
  if (!(cause instanceof client.ClientError))
    return { cause, kind: "request_failed", url };
  if (cause.cause instanceof Response && !cause.cause.ok)
    return { http_status: cause.cause.status, kind: "http_error", url };
  if (
    cause.cause instanceof DOMException &&
    cause.cause.name === "TimeoutError"
  )
    return { kind: "timeout", url };
  if (cause.code === undefined)
    return { cause: cause.cause, kind: "request_failed", url };
  return { cause, kind: "bad_response", url };
}

function oauth_error_fields(cause: unknown) {
  if (!(cause instanceof client.ResponseBodyError)) return {};
  return {
    "oauth.error": cause.error,
    "oauth.error_description": cause.error_description,
  };
}

async function call_federation<T>({
  request,
  url,
}: {
  request: () => Promise<T>;
  url: string;
}): Promise<Result<T, HttpFailure>> {
  log("debug", { event: "proconnect.request", "url.full": url });
  const start = performance.now();
  try {
    const value = await request();
    log("debug", {
      duration_ms: Math.round(performance.now() - start),
      event: "proconnect.response",
      "url.full": url,
    });
    return ok(value);
  } catch (cause) {
    const failure = federation_failure({ cause, url });
    log("debug", {
      duration_ms: Math.round(performance.now() - start),
      event: "proconnect.response",
      ...http_failure_fields(failure),
      ...oauth_error_fields(cause),
    });
    return err(failure);
  }
}

async function discover_federation({
  allow_http_issuer,
  allowed_client_ids,
  client_id,
  client_secret,
  fetch,
  issuer,
}: ResourceServer): Promise<Result<Federation, HttpFailure>> {
  const execute = allow_http_issuer ? [client.allowInsecureRequests] : [];
  const url = `${issuer}/.well-known/openid-configuration`;
  const discovered = await call_federation({
    request: () =>
      client.discovery(
        new URL(issuer),
        client_id,
        undefined,
        client.ClientSecretPost(client_secret),
        { [client.customFetch]: fetch, execute, timeout: TIMEOUT_S },
      ),
    url,
  });
  if (!discovered.ok) return discovered;
  const metadata = discovered.value.serverMetadata();
  const endpoints = server_metadata_schema.safeParse(metadata);
  if (!endpoints.success)
    return err({ cause: endpoints.error, kind: "bad_response", url });
  return ok({
    introspection: {
      config: discovered.value,
      url: endpoints.data.introspection_endpoint,
    },
    userinfo: {
      configs: new Map(
        allowed_client_ids.map((allowed_client_id) => {
          const config = new client.Configuration(
            metadata,
            allowed_client_id,
            undefined,
            client.None(),
          );
          config[client.customFetch] = fetch;
          config.timeout = TIMEOUT_S;
          for (const extension of execute) extension(config);
          return [allowed_client_id, config] as const;
        }),
      ),
      url: endpoints.data.userinfo_endpoint,
    },
  });
}

export function create_verify_access_token(
  resource_server: ResourceServer,
): VerifyAccessToken {
  let federation: Federation | undefined;

  return async function verify_access_token(access_token) {
    if (!federation) {
      const discovered = await discover_federation(resource_server);
      if (!discovered.ok) return discovered;
      federation = discovered.value;
      log("info", {
        allowed_client_ids: [...federation.userinfo.configs.keys()],
        event: "proconnect.discovered",
        issuer: resource_server.issuer,
        "url.introspection": federation.introspection.url,
        "url.userinfo": federation.userinfo.url,
      });
    }
    const { introspection, userinfo } = federation;

    const introspected = await call_federation({
      request: () =>
        client.tokenIntrospection(introspection.config, access_token),
      url: introspection.url,
    });
    if (!introspected.ok) return introspected;
    const parsed = introspection_schema.safeParse(introspected.value);
    if (!parsed.success)
      return err({
        cause: parsed.error,
        kind: "bad_response",
        url: introspection.url,
      });
    log("debug", {
      active: parsed.data.active,
      client_id: parsed.data.client_id,
      event: "proconnect.introspected",
      token_type: parsed.data.token_type,
    });
    const token = judge_introspection({
      introspection: parsed.data,
      userinfo_configs: userinfo.configs,
    });
    if (token.kind === "rejected") return ok(token);

    return judge_userinfo({
      token,
      userinfo: await call_federation({
        request: () =>
          client.fetchUserInfo(token.userinfo_config, access_token, token.sub),
        url: userinfo.url,
      }),
    });
  };
}
