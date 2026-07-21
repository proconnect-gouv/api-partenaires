import { describe, expect, test } from "bun:test";
import { config_schema } from "./config";

describe("analyse de l'environnement", () => {
  test("applique les défauts sur un environnement vide", () => {
    expect(config_schema.parse({})).toEqual({
      PORT: 3000,
      MONGODB_URI: "mongodb://127.0.0.1:27017/partners",
      PARTNERS_CONFIG_FILE: "partners.yaml",
    });
  });

  test("convertit PORT en nombre et rejette les valeurs invalides", () => {
    expect(config_schema.parse({ PORT: "8080" }).PORT).toBe(8080);
    expect(() => config_schema.parse({ PORT: "quatre-vingts" })).toThrow();
  });
});
