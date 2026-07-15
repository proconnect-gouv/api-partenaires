import { Hono } from "hono";

export const app = new Hono()
  .get("/healthz", (c) => c.json({ status: "ok" }))
  .get("/partners/:id/configuration", (c) =>
    c.json({ error: "not_implemented" }, 501),
  )
  .patch("/partners/:id/configuration", (c) =>
    c.json({ error: "not_implemented" }, 501),
  );

export type App = typeof app;
