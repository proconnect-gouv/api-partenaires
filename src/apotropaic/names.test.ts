import { describe, expect, test } from "bun:test";
import { carries_name, name_stems } from "./names";

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
