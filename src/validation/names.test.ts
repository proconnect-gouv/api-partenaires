import { describe, expect, test } from "bun:test";
import {
  carries_name,
  carries_saint_head,
  name_stems,
  reconstructs,
} from "./names";

describe("name_stems", () => {
  test.each([
    ["Challans Gois communauté", "challansgois"],
    ["Chambœuf", "chamboeuf"],
    ["Coise-Saint-Jean-Pied-Gauthier", "coise"],
    ["Fougères Agglomération", "fougeresagglo"],
    ["Guingamp-Paimpol-Agglomération", "guingamppaimpol"],
    ["Guingamp-Paimpol-Agglomération", "guingamppaimpolco"],
    ["L'Abergement-de-Varey", "abergementdevarey"],
    ["L’Abergement-de-Varey", "abergementdevarey"],
    ["La Chapelle-Saint-Sulpice", "chapellestsulpice"],
    ["Saint-Malo", "stmalo"],
    ["Sainte-Gemme", "stegemme"],
    ["St-Quentin-Motte-Croix-Bailly", "saintquentinmottecroixbailly"],
    ["Ste-Gemme", "saintegemme"],
    ["Villers-sur-Mer", "villersmer"],
  ])("%s spells %s", (name, stem) => {
    const stems: ReadonlySet<string> = name_stems(name);
    expect(stems).toContain(stem);
  });

  test.each([
    ["Riom Limagne et Volcans", "riom"],
    ["Saint-Paul-lez-Durance", "saint"],
    ["Saint-Sauveur-le-Vicomte", "sauveur"],
  ])("%s never spells the bare %s", (name, stem) => {
    const stems: ReadonlySet<string> = name_stems(name);
    expect(stems).not.toContain(stem);
  });
});

describe("carries_name (RPNT 2.2)", () => {
  test("a domain carrying the name in a longer label", () => {
    expect(
      carries_name({
        domain: "questembert-communaute.fr",
        name: "Questembert",
      }),
    ).toBe(true);
  });

  test("a short form shared by homonym communes does not carry the full name", () => {
    expect(
      carries_name({ domain: "stpaul.fr", name: "Saint-Paul-lez-Durance" }),
    ).toBe(false);
  });
});

describe("carries_saint_head", () => {
  test.each([
    ["st-sernin.fr", "Saint-Sernin-sur-Rance"],
    ["stesabine.fr", "Sainte-Sabine-sur-Longève"],
  ])("%s carries the saint head of %s", (domain, name) => {
    expect(carries_saint_head({ domain, name })).toBe(true);
  });

  test("a plain saint name has no head beyond itself", () => {
    expect(
      carries_saint_head({ domain: "st-servan.fr", name: "Saint-Malo" }),
    ).toBe(false);
  });

  test("a name without a saint head carries none", () => {
    expect(
      carries_saint_head({ domain: "coise.fr", name: "Coise-Saint-Jean" }),
    ).toBe(false);
  });
});
describe("reconstructs", () => {
  test.each([
    ["coise73.fr", "Coise-Saint-Jean-Pied-Gauthier", "73"],
    ["abzac-16.fr", "Abzac", "16"],
    ["mairie-de-maron.fr", "Maron", "54"],
    ["agglo-agen.fr", "Agen Agglomération", "47"],
    ["ajaccio2a.fr", "Ajaccio", "2A"],
    ["caden.questembert-communaute.fr", "Caden", "56"],
    ["vernou-en-sologne.com", "Vernou-en-Sologne", "41"],
  ])("%s from %s (%s)", (domain, name, departement) => {
    expect(reconstructs({ departement, domain, name })).toBe(true);
  });

  test.each([
    ["stpaul.fr", "Saint-Paul-lez-Durance", "13"],
    ["coise73.xyz", "Coise-Saint-Jean-Pied-Gauthier", "73"],
    ["mairie-73.fr", "Coise-Saint-Jean-Pied-Gauthier", "73"],
  ])("not %s from %s (%s)", (domain, name, departement) => {
    expect(reconstructs({ departement, domain, name })).toBe(false);
  });
});
