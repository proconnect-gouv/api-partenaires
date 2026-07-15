import { describe, expect, test } from "bun:test";
import { load_partners_config } from "./partners_config";

async function write_fixture(content: string) {
  const path = `${process.env.TMPDIR ?? "/tmp"}/partners_config_fixture_${Math.random().toString(36).slice(2)}.yaml`;
  await Bun.write(path, content);
  return path;
}

describe("chargement de la configuration partenaires", () => {
  test("charge un fichier valide", async () => {
    const path = await write_fixture(
      [
        "partners:",
        '  - uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb"',
        "    allowed_fqdns:",
        "      - moncomptepro.fr",
      ].join("\n"),
    );
    expect(await load_partners_config(path)).toEqual({
      partners: [
        {
          uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb",
          allowed_fqdns: ["moncomptepro.fr"],
        },
      ],
    });
  });

  test("rejette un fichier sans liste partners", async () => {
    const path = await write_fixture("autre: chose");
    expect(load_partners_config(path)).rejects.toThrow();
  });

  test("rejette un partenaire sans uid", async () => {
    const path = await write_fixture(
      ["partners:", "  - allowed_fqdns: [a.fr]"].join("\n"),
    );
    expect(load_partners_config(path)).rejects.toThrow();
  });

  test("rejette des allowed_fqdns non-tableau", async () => {
    const path = await write_fixture(
      ["partners:", '  - uid: "x"', "    allowed_fqdns: a.fr"].join("\n"),
    );
    expect(load_partners_config(path)).rejects.toThrow();
  });
});
