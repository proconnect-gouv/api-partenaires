import { createHmac, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function compute_signature(api_secret: string, message: string): string {
  return createHmac("sha256", api_secret).update(message).digest("hex");
}

function safe_equal(a: string, b: string): boolean {
  const a_buf = Buffer.from(a);
  const b_buf = Buffer.from(b);
  if (a_buf.length !== b_buf.length) return false;
  return timingSafeEqual(a_buf, b_buf);
}

export function create_signature_middleware({
  api_secret,
  max_timestamp_diff,
}: {
  api_secret: string;
  max_timestamp_diff: number;
}): MiddlewareHandler {
  return async (c, next) => {
    const signature = c.req.header("X-Signature");
    const timestamp = c.req.header("X-Timestamp");
    const email = c.req.query("email");

    if (!signature || !timestamp || !email) {
      return c.json({ detail: "Missing authentication headers" }, 401);
    }

    if (!EMAIL_RE.test(email)) {
      return c.json({ detail: "Invalid email" }, 422);
    }

    const ts = Number.parseInt(timestamp, 10);
    if (Number.isNaN(ts)) {
      return c.json({ detail: "Invalid timestamp" }, 401);
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > max_timestamp_diff) {
      return c.json({ detail: "Timestamp expired" }, 401);
    }

    const url = new URL(c.req.url);
    const query = url.search ? url.search.slice(1) : "";
    let message = `${timestamp}:${c.req.method}:${url.pathname}?${query}`;

    let body_text = "";
    if (["POST", "PATCH", "PUT"].includes(c.req.method)) {
      body_text = await c.req.text();
      if (body_text) message += `:${body_text}`;
    }

    const expected = compute_signature(api_secret, message);
    if (!safe_equal(signature, expected)) {
      return c.json({ detail: "Invalid signature" }, 401);
    }

    c.set("email", email);
    c.set("body_text", body_text);
    await next();
  };
}
