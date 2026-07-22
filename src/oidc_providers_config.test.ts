import { describe, expect, test } from "bun:test";
import { load_oidc_providers_config } from "./oidc_providers_config";

async function write_fixture(content: string) {
  const path = `${process.env.TMPDIR ?? "/tmp"}/oidc_providers_config_fixture_${Math.random().toString(36).slice(2)}.yaml`;
  await Bun.write(path, content);
  return path;
}

describe("chargement de la configuration fournisseurs OIDC", () => {
  test("charge un fichier valide", async () => {
    const path = await write_fixture(
      [
        "oidc_providers:",
        '  - uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb"',
        "    allowed_fqdns:",
        "      - moncomptepro.fr",
      ].join("\n"),
    );
    expect(await load_oidc_providers_config(path)).toEqual({
      oidc_providers: [
        {
          uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
          allowed_fqdns: ["moncomptepro.fr"],
        },
      ],
    });
  });

  test("rejette un fichier sans liste oidc_providers", async () => {
    const path = await write_fixture("autre: chose");
    expect(load_oidc_providers_config(path)).rejects.toThrow();
  });

  test("rejette un provider sans uid", async () => {
    const path = await write_fixture(
      ["oidc_providers:", "  - allowed_fqdns: [a.fr]"].join("\n"),
    );
    expect(load_oidc_providers_config(path)).rejects.toThrow();
  });

  test("rejette des allowed_fqdns non-tableau", async () => {
    const path = await write_fixture(
      ["oidc_providers:", '  - uid: "x"', "    allowed_fqdns: a.fr"].join("\n"),
    );
    expect(load_oidc_providers_config(path)).rejects.toThrow();
  });
});
