import { randomBytes } from "node:crypto";
import { Hono, type MiddlewareHandler } from "hono";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { decrypt_symetric, encrypt_symetric } from "./crypt";

const SIGNED_RESPONSE_ALGS = ["RS256", "ES256", "HS256"] as const;

const FIXED_SCOPES = [
  "openid",
  "given_name",
  "usual_name",
  "email",
  "uid",
  "siret",
  "phone",
  "idp_id",
  "custom",
  "roles",
  "organization_label",
];

export interface OidcClientDoc {
  _id: ObjectId;
  name?: string;
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  id_token_signed_response_alg?: (typeof SIGNED_RESPONSE_ALGS)[number];
  userinfo_signed_response_alg?: (typeof SIGNED_RESPONSE_ALGS)[number];
  collaborators: string[];
  active?: boolean;
  key: string;
  client_secret: string;
  claims: string[];
  type: "private";
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
  secretUpdatedAt: Date;
  updatedBy: string;
}

export interface OidcClientStore {
  find(filter?: Record<string, unknown>): {
    toArray(): Promise<OidcClientDoc[]>;
  };
  insertOne(
    doc: Omit<OidcClientDoc, "_id"> & { _id?: ObjectId },
  ): Promise<{ acknowledged: boolean; insertedId: ObjectId }>;
  findOne(filter: Record<string, unknown>): Promise<OidcClientDoc | null>;
  updateOne(
    filter: Record<string, unknown>,
    update: { $set: Record<string, unknown> },
  ): Promise<{ matchedCount: number }>;
  deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
}

// mirrors pcdbapi's OidcClient pydantic model: the only fields settable through the API.
// Input is a raw body string — the transform parses JSON and folds parse failures
// into the same ZodError so the handler returns one shaped response for both.
const oidc_client_schema = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid JSON" });
      return z.NEVER;
    }
  })
  .pipe(
    z.strictObject({
      name: z.string().min(1).max(200).optional(),
      redirect_uris: z.array(z.string()).optional(),
      post_logout_redirect_uris: z.array(z.string()).optional(),
      id_token_signed_response_alg: z.enum(SIGNED_RESPONSE_ALGS).optional(),
      userinfo_signed_response_alg: z.enum(SIGNED_RESPONSE_ALGS).optional(),
      collaborators: z.array(z.string()).optional(),
      active: z.boolean().optional(),
    }),
  );

function parse_object_id(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

function format_oidc_client(cipher_pass: string, doc: OidcClientDoc) {
  return {
    _id: doc._id,
    key: doc.key,
    name: doc.name,
    redirect_uris: doc.redirect_uris,
    post_logout_redirect_uris: doc.post_logout_redirect_uris,
    id_token_signed_response_alg: doc.id_token_signed_response_alg,
    userinfo_signed_response_alg: doc.userinfo_signed_response_alg,
    collaborators: doc.collaborators,
    active: doc.active,
    client_secret: decrypt_symetric(cipher_pass, doc.client_secret),
  };
}

const email_middleware: MiddlewareHandler<{
  Variables: { email: string; body_text: string };
}> = async (c, next) => {
  const email = c.req.query("email");
  if (!email) {
    return c.json({ detail: "Missing authentication headers" }, 401);
  }
  const parsed = z.email().safeParse(email);
  if (!parsed.success) {
    return c.json({ detail: "Invalid email" }, 422);
  }
  c.set("email", email);
  await next();
};

export function create_oidc_clients_app({
  oidc_clients,
  client_secret_cipher_pass,
}: {
  oidc_clients: OidcClientStore;
  client_secret_cipher_pass: string;
}) {
  return new Hono<{ Variables: { email: string; body_text: string } }>()
    .use("*", email_middleware)
    .get("/", async (c) => {
      const email = c.get("email");
      const docs = await oidc_clients.find({ collaborators: email }).toArray();
      return c.json(
        docs.map((doc) => format_oidc_client(client_secret_cipher_pass, doc)),
      );
    })
    .post("/", async (c) => {
      const email = c.get("email");
      const parsed = oidc_client_schema.safeParse(c.get("body_text") || "{}");
      if (!parsed.success) return c.json({ detail: parsed.error.issues }, 422);

      const now_date = new Date();
      const collaborators = Array.from(
        new Set([...(parsed.data.collaborators ?? []), email]),
      );

      const doc: Omit<OidcClientDoc, "_id"> = {
        ...parsed.data,
        collaborators,
        createdAt: now_date,
        updatedAt: now_date,
        secretUpdatedAt: now_date,
        updatedBy: "espace-partenaires",
        // format must be 64 hexadecimal characters, matching pcdbapi's secrets.token_hex(32)
        key: randomBytes(32).toString("hex"),
        client_secret: encrypt_symetric(
          client_secret_cipher_pass,
          randomBytes(32).toString("hex"),
        ),
        claims: ["amr"],
        type: "private",
        scopes: FIXED_SCOPES,
      };

      const result = await oidc_clients.insertOne(doc);
      return c.json(
        format_oidc_client(client_secret_cipher_pass, {
          ...doc,
          _id: result.insertedId,
        }),
      );
    })
    .get("/:id", async (c) => {
      const email = c.get("email");
      const oid = parse_object_id(c.req.param("id"));
      if (!oid) return c.json({ detail: "Invalid ObjectId" }, 422);

      const doc = await oidc_clients.findOne({
        _id: oid,
        collaborators: email,
      });
      if (!doc) return c.json({ detail: "Not Found" }, 404);
      return c.json(format_oidc_client(client_secret_cipher_pass, doc));
    })
    .patch("/:id", async (c) => {
      const email = c.get("email");
      const oid = parse_object_id(c.req.param("id"));
      if (!oid) return c.json({ detail: "Invalid ObjectId" }, 422);

      const parsed = oidc_client_schema.safeParse(c.get("body_text") || "{}");
      if (!parsed.success) return c.json({ detail: parsed.error.issues }, 422);

      if (
        parsed.data.collaborators &&
        !parsed.data.collaborators.includes(email)
      ) {
        return c.json(
          { detail: "Cannot remove yourself from collaborators" },
          422,
        );
      }

      const update = {
        ...parsed.data,
        collaborators: Array.from(
          new Set([...(parsed.data.collaborators ?? []), email]),
        ),
        updatedAt: new Date(),
        updatedBy: "espace-partenaires",
      };
      const result = await oidc_clients.updateOne(
        { _id: oid, collaborators: email },
        { $set: update },
      );
      if (!result.matchedCount) return c.json({ detail: "Not Found" }, 404);

      const updated = await oidc_clients.findOne({
        _id: oid,
        collaborators: email,
      });
      if (!updated) return c.json({ detail: "Not Found" }, 404);
      return c.json(format_oidc_client(client_secret_cipher_pass, updated));
    })
    .delete("/:id", async (c) => {
      const email = c.get("email");
      const oid = parse_object_id(c.req.param("id"));
      if (!oid) return c.json({ detail: "Invalid ObjectId" }, 422);

      const result = await oidc_clients.deleteOne({
        _id: oid,
        collaborators: email,
      });
      if (!result.deletedCount) return c.json({ detail: "Not Found" }, 404);
      return c.json({ deleted: true });
    });
}
