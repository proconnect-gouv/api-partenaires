import { describe, expect, test } from "bun:test";
import { config_schema } from "./config";

const REQUIRED_ENV = {
  CLIENT_SECRET_CIPHER_PASS: "test-cipher-pass-32-bytes-long!!",
  OIDC_CLIENTS_API_SECRET: "oidc-clients-api-secret",
  OIDC_PROVIDERS_API_SECRET: "oidc-providers-api-secret",
};

async function write_fixture(content: string) {
  const path = `${process.env.TMPDIR ?? "/tmp"}/config_fixture_${Math.random().toString(36).slice(2)}.yaml`;
  await Bun.write(path, content);
  return path;
}

describe("environment parsing", () => {
  test("applies defaults on a minimal environment", async () => {
    await expect(config_schema.parseAsync(REQUIRED_ENV)).resolves.toEqual({
      CLIENT_SECRET_CIPHER_PASS: REQUIRED_ENV.CLIENT_SECRET_CIPHER_PASS,
      FEATURE_ENABLE_SANDBOX_ENDPOINT: false,
      MAX_TIMESTAMP_DIFF: 300,
      MONGODB_URI: "mongodb://127.0.0.1:27017/partners",
      OIDC_CLIENTS_API_SECRET: REQUIRED_ENV.OIDC_CLIENTS_API_SECRET,
      OIDC_PROVIDERS_API_SECRET: REQUIRED_ENV.OIDC_PROVIDERS_API_SECRET,
      OIDC_PROVIDERS_CONFIG: { oidc_providers: [] },
      PORT: 3000,
    });
  });

  test("charge et valide le fichier oidc_providers.yaml désigné", async () => {
    const path = await write_fixture(
      [
        "oidc_providers:",
        '  - uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb"',
        "    allowed_fqdns:",
        "      - moncomptepro.fr",
      ].join("\n"),
    );
    await expect(
      config_schema.parseAsync({
        ...REQUIRED_ENV,
        OIDC_PROVIDERS_CONFIG: path,
      }),
    ).resolves.toMatchObject({
      OIDC_PROVIDERS_CONFIG: {
        oidc_providers: [
          {
            uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
            allowed_fqdns: ["moncomptepro.fr"],
          },
        ],
      },
    });
  });

  test("rejette un fichier oidc_providers.yaml invalide", async () => {
    const path = await write_fixture("autre: chose");
    await expect(
      config_schema.parseAsync({
        ...REQUIRED_ENV,
        OIDC_PROVIDERS_CONFIG: path,
      }),
    ).rejects.toThrow();
  });

  test("rejects an environment without secrets", async () => {
    await expect(config_schema.parseAsync({})).rejects.toThrow();
  });

  test("coerces PORT to a number and rejects invalid values", async () => {
    await expect(
      config_schema.parseAsync({ ...REQUIRED_ENV, PORT: "8080" }),
    ).resolves.toMatchObject({ PORT: 8080 });
    await expect(
      config_schema.parseAsync({ ...REQUIRED_ENV, PORT: "quatre-vingts" }),
    ).rejects.toThrow();
  });

  test("rejects CLIENT_SECRET_CIPHER_PASS of incorrect length at boot", async () => {
    await expect(
      config_schema.parseAsync({
        ...REQUIRED_ENV,
        CLIENT_SECRET_CIPHER_PASS: "too-short",
      }),
    ).rejects.toThrow();
  });
});
