import { randomBytes } from "node:crypto";

const {
  MOCK_PROCONNECT_ISSUER: issuer,
  MOCK_PROCONNECT_RESOURCE_SERVER_CLIENT_ID: resource_server_client_id,
  MOCK_PROCONNECT_RESOURCE_SERVER_CLIENT_SECRET: resource_server_client_secret,
} = process.env;
if (!issuer || !resource_server_client_id || !resource_server_client_secret)
  throw new Error(
    "MOCK_PROCONNECT_ISSUER, MOCK_PROCONNECT_RESOURCE_SERVER_CLIENT_ID and MOCK_PROCONNECT_RESOURCE_SERVER_CLIENT_SECRET are required",
  );

const ACCESS_TOKEN_TTL_S = 3600;

type Grant = {
  client_id: string;
  email: string;
  expires_at: number;
  issued_at: number;
  sub: string;
  userinfo_signed: boolean;
};

const grants = new Map<string, Grant>();

const now_s = () => Math.floor(Date.now() / 1000);

function live_grant(access_token: string) {
  const grant = grants.get(access_token);
  return grant && grant.expires_at > now_s() ? grant : undefined;
}

function signed_jwt(claims: Record<string, unknown>) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = randomBytes(32).toString("base64url");
  return `${encode({ alg: "RS256", kid: "mock" })}.${encode(claims)}.${signature}`;
}

const server = Bun.serve({
  port: 4000,
  routes: {
    "/api/v2/.well-known/openid-configuration": Response.json({
      introspection_endpoint: `${issuer}/token/introspection`,
      issuer,
      revocation_endpoint: `${issuer}/token/revocation`,
      token_endpoint_auth_methods_supported: [
        "client_secret_post",
        "private_key_jwt",
      ],
      userinfo_endpoint: `${issuer}/userinfo`,
    }),
    "/api/v2/token/introspection": {
      POST: async (req) => {
        const form = new URLSearchParams(await req.text());
        if (
          form.get("client_id") !== resource_server_client_id ||
          form.get("client_secret") !== resource_server_client_secret
        )
          return Response.json(
            {
              error: "invalid_client",
              error_description: "client authentication failed",
            },
            { status: 401 },
          );
        const grant = live_grant(form.get("token") ?? "");
        if (!grant) return Response.json({ active: false });
        return Response.json({
          active: true,
          client_id: grant.client_id,
          exp: grant.expires_at,
          iat: grant.issued_at,
          iss: issuer,
          scope: "openid email",
          sub: grant.sub,
          token_type: "Bearer",
        });
      },
    },
    "/api/v2/token/revocation": {
      POST: async (req) => {
        grants.delete(new URLSearchParams(await req.text()).get("token") ?? "");
        return new Response(null, { status: 200 });
      },
    },
    "/api/v2/userinfo": (req) => {
      const access_token = /^Bearer (\S+)$/i.exec(
        req.headers.get("authorization") ?? "",
      )?.[1];
      const grant = access_token ? live_grant(access_token) : undefined;
      if (!grant)
        return Response.json(
          {
            error: "invalid_token",
            error_description: "invalid token provided",
          },
          {
            headers: {
              "WWW-Authenticate": 'Bearer realm="", error="invalid_token"',
            },
            status: 401,
          },
        );
      const claims = { email: grant.email, sub: grant.sub };
      return grant.userinfo_signed
        ? new Response(
            signed_jwt({ ...claims, aud: grant.client_id, iss: issuer }),
            { headers: { "content-type": "application/jwt; charset=utf-8" } },
          )
        : Response.json(claims);
    },
    "/test/access_tokens": {
      POST: async (req) => {
        const {
          client_id,
          email,
          sub,
          userinfo_signed = false,
        } = (await req.json()) as Omit<
          Grant,
          "expires_at" | "issued_at" | "userinfo_signed"
        > & { userinfo_signed?: boolean };
        const access_token = randomBytes(32).toString("base64url");
        const issued_at = now_s();
        grants.set(access_token, {
          client_id,
          email,
          expires_at: issued_at + ACCESS_TOKEN_TTL_S,
          issued_at,
          sub,
          userinfo_signed,
        });
        return Response.json({ access_token });
      },
    },
  },
});

console.info(`mock ProConnect listening on ${server.url}`);
