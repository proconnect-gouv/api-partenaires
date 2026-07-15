import { describe, expect, test } from "bun:test";
import { app } from "./app";

describe("healthz", () => {
  test("répond 200 avec status ok", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("configuration partenaire", () => {
  test("la lecture n'est pas encore implémentée", async () => {
    const res = await app.request("/partners/123/configuration");
    expect(res.status).toBe(501);
  });

  test("la modification n'est pas encore implémentée", async () => {
    const res = await app.request("/partners/123/configuration", {
      method: "PATCH",
    });
    expect(res.status).toBe(501);
  });
});
