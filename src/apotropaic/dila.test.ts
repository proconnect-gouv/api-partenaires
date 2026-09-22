import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load_dila_export } from "./dila";

describe("load_dila_export", () => {
  let cache_dir: string;

  beforeEach(async () => {
    cache_dir = await mkdtemp(join(tmpdir(), "dila-cache-"));
  });

  afterEach(async () => {
    await rm(cache_dir, { recursive: true, force: true });
  });

  test("sans cache du jour, va chercher l'export et le met en cache", async () => {
    const sample = { records: [{ id: "1" }] };
    let calls = 0;
    const fake_fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify(sample), { status: 200 });
    };

    const result = await load_dila_export({
      fetch: fake_fetch,
      cache_dir,
      today: new Date("2026-09-22T00:00:00Z"),
    });

    expect(result).toEqual(sample);
    expect(calls).toBe(1);
  });

  test("avec un cache du jour deja present, ne fait aucun appel reseau", async () => {
    const sample = { records: [{ id: "cached" }] };
    await Bun.write(
      join(cache_dir, "dila-2026-09-22.json"),
      JSON.stringify(sample),
    );
    const fake_fetch = async () => {
      throw new Error("fetch ne doit pas etre appele");
    };

    const result = await load_dila_export({
      fetch: fake_fetch,
      cache_dir,
      today: new Date("2026-09-22T00:00:00Z"),
    });

    expect(result).toEqual(sample);
  });

  test("refuse une reponse HTTP non-OK", async () => {
    const fake_fetch = async () => {
      return new Response("nope", { status: 500, statusText: "oops" });
    };

    await expect(
      load_dila_export({
        fetch: fake_fetch,
        cache_dir,
        today: new Date("2026-09-22T00:00:00Z"),
      }),
    ).rejects.toThrow();
  });
});
