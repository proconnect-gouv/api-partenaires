import { describe, expect, test } from "bun:test";
import { config_schema } from "./config";

const REQUIRED_ENV = {
  API_SECRET: "api-secret",
  CLIENT_SECRET_CIPHER_PASS: "cipher-pass",
};

describe("analyse de l'environnement", () => {
  test("applique les défauts sur un environnement minimal", () => {
    expect(config_schema.parse(REQUIRED_ENV)).toEqual({
      PORT: 3000,
      MONGODB_URI: "mongodb://127.0.0.1:27017/partners",
      PARTNERS_CONFIG_FILE: "partners.yaml",
      MAX_TIMESTAMP_DIFF: 300,
      ...REQUIRED_ENV,
    });
  });

  test("rejette un environnement sans secrets", () => {
    expect(() => config_schema.parse({})).toThrow();
  });

  test("convertit PORT en nombre et rejette les valeurs invalides", () => {
    expect(config_schema.parse({ ...REQUIRED_ENV, PORT: "8080" }).PORT).toBe(
      8080,
    );
    expect(() =>
      config_schema.parse({ ...REQUIRED_ENV, PORT: "quatre-vingts" }),
    ).toThrow();
  });
});
