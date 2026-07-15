import { describe, expect, test } from "bun:test";
import { config_schema } from "./config";

describe("analyse de l'environnement", () => {
  test("applique les défauts sur un environnement vide", () => {
    expect(config_schema.parse({})).toEqual({
      PORT: 3000,
      MONGODB_URI: "mongodb://127.0.0.1:27017/partners",
      AUTHORIZED_IPS: ["127.0.0.1"],
      PARTNERS_CONFIG_FILE: "partners.yaml",
    });
  });

  test("découpe AUTHORIZED_IPS sur les virgules en ignorant les espaces", () => {
    const config = config_schema.parse({
      AUTHORIZED_IPS: "10.0.0.42, 10.0.0.43",
    });
    expect(config.AUTHORIZED_IPS).toEqual(["10.0.0.42", "10.0.0.43"]);
  });

  test("convertit PORT en nombre et rejette les valeurs invalides", () => {
    expect(config_schema.parse({ PORT: "8080" }).PORT).toBe(8080);
    expect(() => config_schema.parse({ PORT: "quatre-vingts" })).toThrow();
  });
});
