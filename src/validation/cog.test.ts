import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build_cog_names, load_cog_export } from "./cog";

const HEADER =
  '"TYPECOM","COM","REG","DEP","CTCD","ARR","TNCC","NCC","NCCENR","LIBELLE","CAN","COMPARENT"';
const MOVEMENTS_HEADER =
  '"MOD","DATE_EFF","TYPECOM_AV","COM_AV","TNCC_AV","NCC_AV","NCCENR_AV","LIBELLE_AV","TYPECOM_AP","COM_AP","TNCC_AP","NCC_AP","NCCENR_AP","LIBELLE_AP"';

describe("load_cog_export", () => {
  let cache_dir: string;

  beforeEach(async () => {
    cache_dir = await mkdtemp(join(tmpdir(), "cog-cache-"));
  });

  afterEach(async () => {
    await rm(cache_dir, { recursive: true, force: true });
  });

  test("without a cached edition, fetches both files once and caches them", async () => {
    const calls: string[] = [];
    const fake_fetch = async (url: string) => {
      calls.push(url);
      return new Response(
        url.endsWith("/v_mvt_commune_2026.csv") ? MOVEMENTS_HEADER : HEADER,
        { status: 200 },
      );
    };
    const expected = { communes: HEADER, movements: MOVEMENTS_HEADER };

    expect(await load_cog_export({ cache_dir, fetch: fake_fetch })).toEqual(
      expected,
    );
    expect(await load_cog_export({ cache_dir, fetch: fake_fetch })).toEqual(
      expected,
    );
    expect(calls.toSorted()).toEqual([
      "https://www.insee.fr/fr/statistiques/fichier/8740222/v_commune_2026.csv",
      "https://www.insee.fr/fr/statistiques/fichier/8740222/v_mvt_commune_2026.csv",
    ]);
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
    const names = build_cog_names({
      communes: [
        `\uFEFF${HEADER}`,
        '"COM","22209","53","22","22D","222","0","BEAUSSAIS SUR MER","Beaussais-sur-Mer","Beaussais-sur-Mer","2210",""',
        '"COMD","22209","","","","","0","PLOUBALAY","Ploubalay","Ploubalay","","22209"',
        '"COMD","22225","","","","","0","TREGON","Trégon","Trégon","","22209"',
      ].join("\r\n"),
      movements: MOVEMENTS_HEADER,
    });

    expect(names.get("22209")).toEqual(
      new Set(["Beaussais-sur-Mer", "Ploubalay", "Trégon"]),
    );
    expect(names.get("22225")).toEqual(new Set(["Trégon"]));
  });

  test("a renamed commune carries its former name", () => {
    const names = build_cog_names({
      communes: [
        HEADER,
        '"COM","58226","27","58","58D","582","0","SAINT AGNAN EN MORVAN","Saint-Agnan-en-Morvan","Saint-Agnan-en-Morvan","5807",""',
      ].join("\n"),
      movements: [
        MOVEMENTS_HEADER,
        '"10","2025-01-11","COM","58226","0","SAINT AGNAN","Saint-Agnan","Saint-Agnan","COM","58226","0","SAINT AGNAN EN MORVAN","Saint-Agnan-en-Morvan","Saint-Agnan-en-Morvan"',
      ].join("\n"),
    });

    expect(names.get("58226")).toEqual(
      new Set(["Saint-Agnan", "Saint-Agnan-en-Morvan"]),
    );
  });

  test("other movements add no name", () => {
    const names = build_cog_names({
      communes: HEADER,
      movements: [
        MOVEMENTS_HEADER,
        '"20","2011-03-31","","","","","","","COM","97601","1","ACOUA","Acoua","Acoua"',
      ].join("\n"),
    });

    expect(names.size).toBe(0);
  });

  test("keeps both the article-less and the full spelling", () => {
    const names = build_cog_names({
      communes: [
        HEADER,
        '"COM","01001","84","01","01D","012","5","ABERGEMENT CLEMENCIAT","Abergement-Clémenciat","L\'Abergement-Clémenciat","0108",""',
      ].join("\n"),
      movements: MOVEMENTS_HEADER,
    });

    expect(names.get("01001")).toEqual(
      new Set(["L'Abergement-Clémenciat", "Abergement-Clémenciat"]),
    );
  });

  test("refuses an edition whose columns changed", () => {
    expect(() =>
      build_cog_names({
        communes: [
          '"TYPECOM","COM","LIBELLE"',
          '"COM","01001","Abergement"',
        ].join("\n"),
        movements: MOVEMENTS_HEADER,
      }),
    ).toThrow();
  });

  test("refuses a row whose INSEE code is malformed", () => {
    expect(() =>
      build_cog_names({
        communes: [
          HEADER,
          '"COM","1001","84","01","01D","012","5","X","Abergement","Abergement","0108",""',
        ].join("\n"),
        movements: MOVEMENTS_HEADER,
      }),
    ).toThrow();
  });
});
