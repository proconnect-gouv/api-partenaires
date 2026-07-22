import { describe, expect, test } from "bun:test";
import { config_schema } from "./config";

const REQUIRED_ENV = {
  OIDC_PROVIDERS_API_SECRET: "oidc-providers-api-secret",
  SANDBOX_API_SECRET: "sandbox-api-secret",
  CLIENT_SECRET_CIPHER_PASS: "test-cipher-pass-32-bytes-long!!",
};

describe("environment parsing", () => {
  test("applies defaults on a minimal environment", () => {
    expect(config_schema.parse(REQUIRED_ENV)).toEqual({
      PORT: 3000,
      MONGODB_URI: "mongodb://127.0.0.1:27017/partners",
      OIDC_PROVIDERS_CONFIG_FILE: "oidc_providers.yaml",
      MAX_TIMESTAMP_DIFF: 300,
      FEATURE_ENABLE_SANDBOX_ENDPOINT: false,
      ...REQUIRED_ENV,
    });
  });

  test("rejects an environment without secrets", () => {
    expect(() => config_schema.parse({})).toThrow();
  });

  test("coerces PORT to a number and rejects invalid values", () => {
    expect(config_schema.parse({ ...REQUIRED_ENV, PORT: "8080" }).PORT).toBe(
      8080,
    );
    expect(() =>
      config_schema.parse({ ...REQUIRED_ENV, PORT: "quatre-vingts" }),
    ).toThrow();
  });

  test("rejects CLIENT_SECRET_CIPHER_PASS of incorrect length at boot", () => {
    expect(() =>
      config_schema.parse({
        ...REQUIRED_ENV,
        CLIENT_SECRET_CIPHER_PASS: "too-short",
      }),
    ).toThrow();
  });
});
