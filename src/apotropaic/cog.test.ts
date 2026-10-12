import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build_cog_names, load_cog_export } from "./cog";

const HEADER =
  '"TYPECOM","COM","REG","DEP","CTCD","ARR","TNCC","NCC","NCCENR","LIBELLE","CAN","COMPARENT"';

describe("load_cog_export", () => {
  let cache_dir: string;

  beforeEach(async () => {
    cache_dir = await mkdtemp(join(tmpdir(), "cog-cache-"));
  });

  afterEach(async () => {
    await rm(cache_dir, { recursive: true, force: true });
  });

  test("without a cached edition, fetches it once and caches it", async () => {
    let calls = 0;
    const fake_fetch = async () => {
      calls += 1;
      return new Response(HEADER, { status: 200 });
    };

    expect(await load_cog_export({ cache_dir, fetch: fake_fetch })).toBe(
      HEADER,
    );
    expect(await load_cog_export({ cache_dir, fetch: fake_fetch })).toBe(
      HEADER,
    );
    expect(calls).toBe(1);
  });

  test("refuses a non-OK HTTP response", async () => {
    const fake_fetch = async () =>
      new Response("nope", { status: 500, statusText: "oops" });

    await expect(
      load_cog_export({ cache_dir, fetch: fake_fetch }),
    ).rejects.toThrow();
  });
});

describe("build_cog_names", () => {
  test("a commune nouvelle carries its former communes' names", () => {
    const names = build_cog_names(
      [
        `\uFEFF${HEADER}`,
        '"COM","22209","53","22","22D","222","0","BEAUSSAIS SUR MER","Beaussais-sur-Mer","Beaussais-sur-Mer","2210",""',
        '"COMD","22209","","","","","0","PLOUBALAY","Ploubalay","Ploubalay","","22209"',
        '"COMD","22225","","","","","0","TREGON","Trégon","Trégon","","22209"',
      ].join("\r\n"),
    );

    expect(names.get("22209")).toEqual(
      new Set(["Beaussais-sur-Mer", "Ploubalay", "Trégon"]),
    );
    expect(names.get("22225")).toEqual(new Set(["Trégon"]));
  });

  test("keeps both the article-less and the full spelling", () => {
    const names = build_cog_names(
      [
        HEADER,
        '"COM","01001","84","01","01D","012","5","ABERGEMENT CLEMENCIAT","Abergement-Clémenciat","L\'Abergement-Clémenciat","0108",""',
      ].join("\n"),
    );

    expect(names.get("01001")).toEqual(
      new Set(["L'Abergement-Clémenciat", "Abergement-Clémenciat"]),
    );
  });

  test("refuses an edition whose columns changed", () => {
    expect(() =>
      build_cog_names(
        ['"TYPECOM","COM","LIBELLE"', '"COM","01001","Abergement"'].join("\n"),
      ),
    ).toThrow();
  });

  test("refuses a row whose INSEE code is malformed", () => {
    expect(() =>
      build_cog_names(
        [
          HEADER,
          '"COM","1001","84","01","01D","012","5","X","Abergement","Abergement","0108",""',
        ].join("\n"),
      ),
    ).toThrow();
  });
});
