import { $ } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const proxy_url = "http://127.0.0.1:8080";
const uid = "71144ab3-ee1a-4401-b7b3-79b44f7daeeb";
const configuration_path = `/partners/${uid}/configuration`;

beforeAll(async () => {
  await $`docker compose up --detach --build --quiet-pull --wait`.cwd(
    import.meta.dir,
  );
}, 180_000);

afterAll(async () => {
  await $`docker compose down --volumes`.cwd(import.meta.dir);
}, 60_000);

describe("contrat du proxy: X-Forwarded-For posé par le proxy, jamais par le client", () => {
  test("l'application n'est pas joignable directement", async () => {
    expect(fetch("http://127.0.0.1:3000/livez")).rejects.toThrow();
  });

  test("une IP autorisée passe par le proxy sans fournir d'en-tête", async () => {
    const res = await fetch(`${proxy_url}${configuration_path}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      uid,
      name: "moncomptepro",
      fqdns: ["moncomptepro.fr"],
    });
  });

  test("un en-tête usurpé depuis une IP autorisée est réécrit par le proxy", async () => {
    const res = await fetch(`${proxy_url}${configuration_path}`, {
      headers: { "X-Forwarded-For": "203.0.113.7" },
    });
    expect(res.status).toBe(200);
  });

  test("une IP non autorisée est refusée même en usurpant une IP permise", async () => {
    const result =
      await $`docker compose exec attacker curl -s -o /dev/null -w %{http_code} -H X-Forwarded-For:172.28.0.1 http://proxy${configuration_path}`
        .cwd(import.meta.dir)
        .text();
    expect(result.trim()).toBe("403");
  });
});
