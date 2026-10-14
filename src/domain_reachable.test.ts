import { describe, expect, test } from "bun:test";
import { create_find_unreachable_domains } from "./domain_reachable";

const MX_RECORD = { type: 15, data: "1 mx.example.fr." };
const A_RECORD = { type: 1, data: "192.0.2.1" };
const CNAME_RECORD = { type: 5, data: "alias.example.fr." };

function fake_dns({ A, MX }: { A: object; MX: object }) {
  const types: string[] = [];
  const find_unreachable_domains = create_find_unreachable_domains({
    fetch: async (url) => {
      const type = new URL(url).searchParams.get("type") ?? "";
      types.push(type);
      return Response.json(type === "MX" ? MX : A);
    },
  });
  return { find_unreachable_domains, types };
}

describe("find_unreachable_domains", () => {
  test("accepts a domain with an MX record without querying A", async () => {
    const dns = fake_dns({
      A: { Status: 0 },
      MX: { Status: 0, Answer: [MX_RECORD] },
    });
    expect(await dns.find_unreachable_domains(["example.fr"])).toEqual([]);
    expect(dns.types).toEqual(["MX"]);
  });

  test("refuses a domain that does not exist without querying A", async () => {
    const dns = fake_dns({ A: { Status: 3 }, MX: { Status: 3 } });
    expect(await dns.find_unreachable_domains(["example.fr"])).toEqual([
      "example.fr",
    ]);
    expect(dns.types).toEqual(["MX"]);
  });

  test("accepts a domain without MX that has an A record", async () => {
    const dns = fake_dns({
      A: { Status: 0, Answer: [A_RECORD] },
      MX: { Status: 0 },
    });
    expect(await dns.find_unreachable_domains(["example.fr"])).toEqual([]);
    expect(dns.types).toEqual(["MX", "A"]);
  });

  test("refuses a domain without MX nor A record", async () => {
    const dns = fake_dns({ A: { Status: 0 }, MX: { Status: 0 } });
    expect(await dns.find_unreachable_domains(["example.fr"])).toEqual([
      "example.fr",
    ]);
  });

  test("refuses a null MX even when an A record exists", async () => {
    const dns = fake_dns({
      A: { Status: 0, Answer: [A_RECORD] },
      MX: { Status: 0, Answer: [{ type: 15, data: "0 ." }] },
    });
    expect(await dns.find_unreachable_domains(["example.fr"])).toEqual([
      "example.fr",
    ]);
  });

  test("does not count a CNAME alone as reachable", async () => {
    const dns = fake_dns({
      A: { Status: 0, Answer: [CNAME_RECORD] },
      MX: { Status: 0, Answer: [CNAME_RECORD] },
    });
    expect(await dns.find_unreachable_domains(["example.fr"])).toEqual([
      "example.fr",
    ]);
  });

  test("throws when dns.google answers an HTTP error", async () => {
    const find_unreachable_domains = create_find_unreachable_domains({
      fetch: async () => new Response("rate limited", { status: 429 }),
    });
    await expect(find_unreachable_domains(["example.fr"])).rejects.toThrow(
      "429",
    );
  });

  test("keeps at most 10 lookups in flight", async () => {
    let in_flight = 0;
    let max_in_flight = 0;
    const find_unreachable_domains = create_find_unreachable_domains({
      fetch: async () => {
        max_in_flight = Math.max(max_in_flight, ++in_flight);
        await Promise.resolve();
        in_flight--;
        return Response.json({ Status: 0, Answer: [MX_RECORD] });
      },
    });
    const domains = Array.from({ length: 50 }, (_, i) => `d${i}.fr`);
    expect(await find_unreachable_domains(domains)).toEqual([]);
    expect(max_in_flight).toBe(10);
  });
});
