import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { is_domain_reachable } from "./domain_reachable";

function mock_dns({ A, MX }: { A: object; MX: object }) {
  return spyOn(globalThis, "fetch").mockImplementation((async (input: string) =>
    Response.json(
      new URL(input).searchParams.get("type") === "MX" ? MX : A,
    )) as typeof fetch);
}

afterEach(() => {
  mock.restore();
});

describe("is_domain_reachable", () => {
  test("accepts a domain with an MX record without querying A", async () => {
    const fetch = mock_dns({
      A: { Status: 0 },
      MX: { Status: 0, Answer: [{ type: 15, data: "1 mx.example.fr." }] },
    });
    expect(await is_domain_reachable("example.fr")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("refuses a domain that does not exist without querying A", async () => {
    const fetch = mock_dns({ A: { Status: 3 }, MX: { Status: 3 } });
    expect(await is_domain_reachable("example.fr")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("accepts a domain without MX that has an A record", async () => {
    const fetch = mock_dns({
      A: { Status: 0, Answer: [{ type: 1, data: "192.0.2.1" }] },
      MX: { Status: 0 },
    });
    expect(await is_domain_reachable("example.fr")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("refuses a domain without MX nor A record", async () => {
    mock_dns({ A: { Status: 0 }, MX: { Status: 0 } });
    expect(await is_domain_reachable("example.fr")).toBe(false);
  });
});
