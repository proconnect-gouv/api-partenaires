import { describe, expect, test } from "bun:test";
import {
  create_find_unreachable_domains,
  decide_from_a,
  decide_from_mx,
} from "./domain_reachable";

const MX_RECORD = { type: 15, data: "1 mx.example.fr." };
const A_RECORD = { type: 1, data: "192.0.2.1" };
const CNAME_RECORD = { type: 5, data: "alias.example.fr." };

describe("decide_from_mx", () => {
  test("an MX record makes the domain reachable", () => {
    expect(decide_from_mx({ Answer: [MX_RECORD], Status: 0 })).toEqual({
      kind: "reachable",
    });
  });

  test("a null MX refuses mail, whatever the A record says", () => {
    expect(
      decide_from_mx({ Answer: [{ type: 15, data: "0 ." }], Status: 0 }),
    ).toEqual({ kind: "unreachable", reason: "null_mx" });
  });

  test("NXDOMAIN needs no A lookup", () => {
    expect(decide_from_mx({ Status: 3 })).toEqual({
      kind: "unreachable",
      reason: "nxdomain",
    });
  });

  test("no MX, or a CNAME alone, asks for the A record", () => {
    expect(decide_from_mx({ Status: 0 })).toEqual({ kind: "ask_a" });
    expect(decide_from_mx({ Answer: [CNAME_RECORD], Status: 0 })).toEqual({
      kind: "ask_a",
    });
  });
});

describe("decide_from_a", () => {
  test("an A record makes the domain reachable", () => {
    expect(decide_from_a({ Answer: [A_RECORD], Status: 0 })).toEqual({
      kind: "reachable",
    });
  });

  test("a CNAME alone is not an A record", () => {
    expect(decide_from_a({ Answer: [CNAME_RECORD], Status: 0 })).toEqual({
      kind: "unreachable",
      reason: "no_record",
    });
  });
});

describe("find_unreachable_domains", () => {
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

  test("asks only MX when it decides", async () => {
    const dns = fake_dns({ A: { Status: 0 }, MX: { Status: 3 } });
    expect(await dns.find_unreachable_domains(["example.fr"])).toEqual({
      ok: true,
      value: ["example.fr"],
    });
    expect(dns.types).toEqual(["MX"]);
  });

  test("asks A when MX has no record", async () => {
    const dns = fake_dns({
      A: { Answer: [A_RECORD], Status: 0 },
      MX: { Status: 0 },
    });
    expect(await dns.find_unreachable_domains(["example.fr"])).toEqual({
      ok: true,
      value: [],
    });
    expect(dns.types).toEqual(["MX", "A"]);
  });

  test("returns an HTTP error as a failure", async () => {
    const find_unreachable_domains = create_find_unreachable_domains({
      fetch: async () => new Response("rate limited", { status: 429 }),
    });
    expect(await find_unreachable_domains(["example.fr"])).toEqual({
      ok: false,
      error: {
        domain: "example.fr",
        kind: "http_status",
        status: 429,
        type: "MX",
      },
    });
  });

  test("returns an unexpected body as a failure", async () => {
    const find_unreachable_domains = create_find_unreachable_domains({
      fetch: async () => Response.json({ Status: "ok" }),
    });
    const result = await find_unreachable_domains(["example.fr"]);
    expect(result.ok || result.error.kind).toBe("bad_response");
  });

  test("aborts the lookups in flight and reports the first failure", async () => {
    const signals: AbortSignal[] = [];
    const find_unreachable_domains = create_find_unreachable_domains({
      fetch: (_url, { signal }) => {
        signals.push(signal);
        if (signals.length === 1)
          return Promise.resolve(new Response("", { status: 503 }));
        const { promise, reject } = Promise.withResolvers<Response>();
        signal.addEventListener("abort", () => reject(signal.reason));
        return promise;
      },
    });
    const domains = Array.from({ length: 50 }, (_, i) => `d${i}.fr`);
    const result = await find_unreachable_domains(domains);
    expect(result.ok || result.error).toMatchObject({
      domain: "d0.fr",
      kind: "http_status",
    });
    expect(signals).toHaveLength(10);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
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
    expect(await find_unreachable_domains(domains)).toEqual({
      ok: true,
      value: [],
    });
    expect(max_in_flight).toBe(10);
  });
});
