import { z } from "zod";
import { err, ok, type Result } from "./result";

const A = 1;
const CONCURRENCY = 10;
const MX = 15;
const NULL_MX = "0 .";
const NXDOMAIN = 3;
const TIMEOUT_MS = 5_000;
const dns_response_schema = z.object({
  Answer: z.array(z.object({ data: z.string(), type: z.number() })).optional(),
  Status: z.number(),
});

export type DnsResponse = z.infer<typeof dns_response_schema>;

export type Reachability =
  | { readonly kind: "reachable" }
  | {
      readonly kind: "unreachable";
      readonly reason: "no_record" | "null_mx" | "nxdomain";
    };

export function decide_from_mx(
  mx: DnsResponse,
): Reachability | { readonly kind: "ask_a" } {
  const records = (mx.Answer ?? []).filter(({ type }) => type === MX);
  if (records.some(({ data }) => data === NULL_MX))
    return { kind: "unreachable", reason: "null_mx" };
  if (records.length > 0) return { kind: "reachable" };
  if (mx.Status === NXDOMAIN)
    return { kind: "unreachable", reason: "nxdomain" };
  return { kind: "ask_a" };
}

export function decide_from_a(a: DnsResponse): Reachability {
  return (a.Answer ?? []).some(({ type }) => type === A)
    ? { kind: "reachable" }
    : { kind: "unreachable", reason: "no_record" };
}

type RecordType = "A" | "MX";

export type DnsFailure = {
  readonly domain: string;
  readonly type: RecordType;
} & (
  | {
      readonly kind: "bad_response";
      readonly issues: readonly z.core.$ZodIssue[];
    }
  | { readonly kind: "http_status"; readonly status: number }
  | { readonly kind: "request_failed"; readonly cause: unknown }
);

export type FindUnreachableDomains = (
  domains: readonly string[],
) => Promise<Result<readonly string[], DnsFailure>>;

type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

export function create_find_unreachable_domains({
  fetch,
}: {
  fetch: Fetch;
}): FindUnreachableDomains {
  async function resolve({
    domain,
    signal,
    type,
  }: {
    domain: string;
    signal: AbortSignal;
    type: RecordType;
  }): Promise<Result<DnsResponse, DnsFailure>> {
    const query = new URLSearchParams({ name: domain, type }).toString();
    const url = `https://dns.google/resolve?${query}`;
    let body: unknown;
    try {
      const res = await fetch(url, { signal });
      if (!res.ok)
        return err({ domain, kind: "http_status", status: res.status, type });
      body = await res.json();
    } catch (cause) {
      return err({ cause, domain, kind: "request_failed", type });
    }
    const parsed = dns_response_schema.safeParse(body);
    if (!parsed.success)
      return err({
        domain,
        issues: parsed.error.issues,
        kind: "bad_response",
        type,
      });
    return ok(parsed.data);
  }

  async function check({
    domain,
    signal,
  }: {
    domain: string;
    signal: AbortSignal;
  }): Promise<Result<Reachability, DnsFailure>> {
    const mx = await resolve({ domain, signal, type: "MX" });
    if (!mx.ok) return mx;
    const after_mx = decide_from_mx(mx.value);
    if (after_mx.kind !== "ask_a") return ok(after_mx);
    const a = await resolve({ domain, signal, type: "A" });
    if (!a.ok) return a;
    return ok(decide_from_a(a.value));
  }

  return async function find_unreachable_domains(domains) {
    const queue = [...domains];
    const stop = new AbortController();
    const unreachable = new Set<string>();
    let failure: DnsFailure | undefined;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (
          let domain = queue.shift();
          domain !== undefined && failure === undefined;
          domain = queue.shift()
        ) {
          const signal = AbortSignal.any([
            stop.signal,
            AbortSignal.timeout(TIMEOUT_MS),
          ]);
          const reachability = await check({ domain, signal });
          if (!reachability.ok) {
            failure ??= reachability.error;
            stop.abort();
            return;
          }
          if (reachability.value.kind === "unreachable")
            unreachable.add(domain);
        }
      }),
    );
    if (failure !== undefined) return err(failure);
    return ok(domains.filter((domain) => unreachable.has(domain)));
  };
}
