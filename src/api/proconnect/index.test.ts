import { afterAll, describe, expect, test } from "bun:test";

import { ok } from "#src/utils";

import { create_verify_access_token } from "./index";

type Introspection = Record<string, unknown>;
type Userinfo = { body: string; content_type: string; status: number };

let introspection: Introspection | number = {};
let userinfo: Userinfo = {
  body: "{}",
  content_type: "application/json",
  status: 200,
};
const introspection_requests: URLSearchParams[] = [];
const userinfo_authorizations: (string | null)[] = [];

const federation = Bun.serve({
  port: 0,
  routes: {
    "/api/v2/token/introspection": {
      POST: async (req) => {
        introspection_requests.push(new URLSearchParams(await req.text()));
        return typeof introspection === "number"
          ? new Response("down", { status: introspection })
          : Response.json(introspection);
      },
    },
    "/api/v2/userinfo": (req) => {
      userinfo_authorizations.push(req.headers.get("authorization"));
      return new Response(userinfo.body, {
        headers: { "content-type": userinfo.content_type },
        status: userinfo.status,
      });
    },
  },
});
afterAll(() => federation.stop());

const INTROSPECTION_URL = `http://localhost:${federation.port}/api/v2/token/introspection`;
const USERINFO_URL = `http://localhost:${federation.port}/api/v2/userinfo`;

const JEANNE = {
  access_token: "jeanne-access-token",
  email: "jeanne.dupont@example.gouv.fr",
  sub: "jeanne-sub",
};

const JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES = {
  active: true,
  client_id: "espace-partenaires",
  sub: JEANNE.sub,
  token_type: "Bearer",
};

const JEANNE_VERIFIED = ok({
  client_id: "espace-partenaires",
  email: JEANNE.email,
  kind: "verified",
  sub: JEANNE.sub,
} as const);

function verify(fetch_impl: typeof fetch = fetch) {
  return create_verify_access_token({
    allowed_client_id: "espace-partenaires",
    client_id: "api-partenaires",
    client_secret: "api-partenaires-secret",
    fetch: fetch_impl,
    issuer: `http://localhost:${federation.port}/api/v2`,
  })(JEANNE.access_token);
}

function given_the_federation_answers({
  introspection_response,
  userinfo_response,
}: {
  introspection_response: Introspection | number;
  userinfo_response?: Partial<Userinfo>;
}) {
  introspection = introspection_response;
  userinfo = {
    body: "{}",
    content_type: "application/json",
    status: 200,
    ...userinfo_response,
  };
  introspection_requests.length = 0;
  userinfo_authorizations.length = 0;
}

function signed_jwt(claims: Record<string, unknown>) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "ES256" })}.${encode(claims)}.unchecked-signature`;
}

describe("verify_access_token", () => {
  test("introspects with the API's own credentials, then reads the email with the token", async () => {
    given_the_federation_answers({
      introspection_response: JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
      userinfo_response: { body: JSON.stringify({ email: JEANNE.email }) },
    });

    expect(await verify()).toEqual(JEANNE_VERIFIED);
    expect(Object.fromEntries(introspection_requests[0] ?? [])).toEqual({
      client_id: "api-partenaires",
      client_secret: "api-partenaires-secret",
      token: JEANNE.access_token,
    });
    expect(userinfo_authorizations).toEqual([`Bearer ${JEANNE.access_token}`]);
  });

  test("lowercases the email", async () => {
    given_the_federation_answers({
      introspection_response: JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
      userinfo_response: {
        body: JSON.stringify({ email: "Jeanne.Dupont@Example.gouv.fr" }),
      },
    });

    expect(await verify()).toEqual(JEANNE_VERIFIED);
  });

  test.each([
    { content_type: "application/jwt" },
    { content_type: "application/octet-stream" },
  ])(
    "reads the email from a signed userinfo JWT served as $content_type",
    async ({ content_type }) => {
      given_the_federation_answers({
        introspection_response: JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
        userinfo_response: {
          body: signed_jwt({ email: JEANNE.email }),
          content_type,
        },
      });

      expect(await verify()).toEqual(JEANNE_VERIFIED);
    },
  );

  test.each([
    {
      introspection_response: { active: false },
      reason: "token_inactive",
      title: "an expired or revoked token",
    },
    {
      introspection_response: {
        ...JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
        client_id: "service-voisin",
      },
      reason: "token_client_mismatch",
      title: "a token issued to another service",
    },
    {
      introspection_response: {
        ...JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
        client_id: undefined,
      },
      reason: "token_client_mismatch",
      title: "a token without a client id",
    },
    {
      introspection_response: {
        ...JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
        token_type: "refresh_token",
      },
      reason: "token_type_mismatch",
      title: "a refresh token",
    },
    {
      introspection_response: {
        ...JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
        sub: undefined,
      },
      reason: "token_subject_missing",
      title: "a token without a subject",
    },
  ] as const)(
    "rejects $title without calling userinfo",
    async ({ introspection_response, reason }) => {
      given_the_federation_answers({ introspection_response });

      expect(await verify()).toEqual(ok({ kind: "rejected", reason }));
      expect(userinfo_authorizations).toEqual([]);
    },
  );

  test("rejects a token whose federation session ended before userinfo", async () => {
    given_the_federation_answers({
      introspection_response: JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
      userinfo_response: { status: 401 },
    });

    expect(await verify()).toEqual(
      ok({ kind: "rejected", reason: "token_inactive" }),
    );
  });

  test.each([
    { body: JSON.stringify({ sub: JEANNE.sub }), title: "no email claim" },
    { body: JSON.stringify({ email: null }), title: "a null email" },
    { body: signed_jwt({ email: "jeanne" }), title: "a malformed email" },
  ])("rejects a token whose userinfo carries $title", async ({ body }) => {
    given_the_federation_answers({
      introspection_response: JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
      userinfo_response: { body },
    });

    expect(await verify()).toEqual(
      ok({ kind: "rejected", reason: "token_email_missing" }),
    );
  });

  test("reports the failing URL when the federation answers with an error status", async () => {
    given_the_federation_answers({ introspection_response: 502 });

    expect(await verify()).toEqual({
      error: { http_status: 502, kind: "http_error", url: INTROSPECTION_URL },
      ok: false,
    });
  });

  test.each([
    { body: "<html>maintenance</html>", title: "an HTML page" },
    {
      body: "header.encrypted-key.iv.ciphertext.tag",
      title: "an encrypted JWT",
    },
  ])("reports $title on userinfo as a bad response", async ({ body }) => {
    given_the_federation_answers({
      introspection_response: JEANNE_TOKEN_FOR_ESPACE_PARTENAIRES,
      userinfo_response: { body },
    });

    expect(await verify()).toMatchObject({
      error: { kind: "bad_response", url: USERINFO_URL },
      ok: false,
    });
  });

  test("reports the failing URL when the federation times out", async () => {
    const federation_never_answering = (async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch;

    expect(await verify(federation_never_answering)).toEqual({
      error: { kind: "timeout", url: INTROSPECTION_URL },
      ok: false,
    });
  });
});
