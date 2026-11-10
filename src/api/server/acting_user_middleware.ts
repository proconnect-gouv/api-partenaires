import type { Context, Env, MiddlewareHandler, Next } from "hono";
import { every } from "hono/combine";

import {
  type ActingUser,
  hmac_acting_user,
  token_acting_user,
} from "#src/api/acting_user";
import { email_schema } from "#src/api/email";
import { http_failure_fields } from "#src/api/http";
import { log } from "#src/api/log";
import type { VerifyAccessToken } from "#src/api/proconnect";
import { assert_never } from "#src/utils";

import { create_rate_limit_middleware } from "./rate_limit_middleware";
import { create_signature_middleware } from "./signature_middleware";

const acting_user_middleware_brand: unique symbol = Symbol(
  "acting_user_middleware",
);

type ActingUserContext = { Variables: { acting_user: ActingUser } };

type MiddlewareEnv<M> = M extends (
  c: Context<infer E, string, {}>,
  next: Next,
) => unknown
  ? E
  : never;

const combine = <E extends Env>(
  ...middleware: MiddlewareHandler<E>[]
): MiddlewareHandler<E> => every(...middleware);

const hmac_identity_middleware: MiddlewareHandler<ActingUserContext> = async (
  c,
  next,
) => {
  const email = c.req.query("email");
  if (!email) {
    return c.json({ detail: "Missing authentication headers" }, 401);
  }
  const parsed = email_schema.safeParse(email);
  if (!parsed.success) {
    return c.json({ detail: "Invalid email" }, 422);
  }
  c.set("acting_user", hmac_acting_user(parsed.data));
  await next();
};

function create_access_token_middleware({
  verify_access_token,
}: {
  verify_access_token: VerifyAccessToken;
}): MiddlewareHandler<ActingUserContext> {
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
      log("error", {
        event: "proconnect.request.failed",
        ...http_failure_fields(verified.error),
      });
      return c.json({ detail: "Identity provider unavailable" }, 503);
    }
    const verdict = verified.value;
    switch (verdict.kind) {
      case "rejected":
        log("debug", { event: "auth.rejected", reason: verdict.reason });
        c.header("WWW-Authenticate", 'Bearer error="invalid_token"');
        return c.json({ detail: "Invalid token" }, 401);
      case "verified":
        c.set(
          "acting_user",
          token_acting_user({
            client_id: verdict.client_id,
            email: verdict.email,
            sub: verdict.sub,
          }),
        );
        await next();
        return;
      default:
        return assert_never(verdict);
    }
  };
}

function choose_auth<E extends Env>(
  by_signature: MiddlewareHandler<E>,
  by_token: MiddlewareHandler<E>,
): MiddlewareHandler<E> {
  return async (c, next) =>
    c.req.header("Authorization") === undefined
      ? by_signature(c, next)
      : by_token(c, next);
}

function build_acting_user_middleware({
  api_secret,
  max_timestamp_diff,
  rate_limit_per_minute,
  rate_limit_per_minute_per_user,
  verify_access_token,
}: {
  api_secret: string;
  max_timestamp_diff: number;
  rate_limit_per_minute: number;
  rate_limit_per_minute_per_user: number;
  verify_access_token: VerifyAccessToken | undefined;
}) {
  const by_signature = combine<ActingUserContext>(
    create_signature_middleware({ api_secret, max_timestamp_diff }),
    create_rate_limit_middleware<string, ActingUserContext>({
      key: () => "oidc_clients",
      limit_per_minute: rate_limit_per_minute,
    }),
    hmac_identity_middleware,
  );
  if (!verify_access_token) return by_signature;
  const by_token = combine<ActingUserContext>(
    create_rate_limit_middleware<string, ActingUserContext>({
      key: () => "oidc_clients_token",
      limit_per_minute: rate_limit_per_minute,
    }),
    create_access_token_middleware({ verify_access_token }),
    create_rate_limit_middleware<string, ActingUserContext>({
      key: (c) => {
        const acting_user = c.get("acting_user");
        switch (acting_user.auth) {
          case "token":
            return acting_user.sub;
          case "hmac":
            throw new Error("token rate limit requires a token user");
          default:
            return assert_never(acting_user);
        }
      },
      limit_per_minute: rate_limit_per_minute_per_user,
    }),
  );
  return choose_auth(by_signature, by_token);
}

export type ActingUserEnv = MiddlewareEnv<
  ReturnType<typeof build_acting_user_middleware>
>;

export type ActingUserMiddleware = MiddlewareHandler<ActingUserEnv> & {
  readonly [acting_user_middleware_brand]: true;
};

export function create_acting_user_middleware(
  args: Parameters<typeof build_acting_user_middleware>[0],
): ActingUserMiddleware {
  return Object.assign(build_acting_user_middleware(args), {
    [acting_user_middleware_brand]: true as const,
  });
}
