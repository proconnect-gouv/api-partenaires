import { z } from "zod";
import { err, ok, type Result } from "./result";
import { log } from "./log";

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
): Reachability | { readonly kind: "no_mx" } {
  const records = (mx.Answer ?? []).filter(({ type }) => type === MX);
  if (records.some(({ data }) => data === NULL_MX))
    return { kind: "unreachable", reason: "null_mx" };
  if (records.length > 0) return { kind: "reachable" };
  if (mx.Status === NXDOMAIN)
    return { kind: "unreachable", reason: "nxdomain" };
  return { kind: "no_mx" };
}

export function decide_from_a(a: DnsResponse): Reachability {
  return (a.Answer ?? []).some(({ type }) => type === A)
    ? { kind: "reachable" }
    : { kind: "unreachable", reason: "no_record" };
}

type RecordType = "A" | "MX";

export type DnsFailure = {
  readonly domain: string;
  readonly record_type: RecordType;
} & (
  | {
      readonly kind: "bad_response";
      readonly issues: readonly z.core.$ZodIssue[];
    }
  | { readonly kind: "http_error"; readonly http_status: number }
  | { readonly kind: "request_failed"; readonly cause: unknown }
  | { readonly kind: "timeout" }
);

function dns_lookup_failed_fields(failure: DnsFailure): {
  readonly event: "dns.lookup.failed";
} & Record<string, unknown> {
  const fields = {
    domain: failure.domain,
    error_type: failure.kind,
    event: "dns.lookup.failed",
    record_type: failure.record_type,
  } as const;
  switch (failure.kind) {
    case "bad_response":
      return { ...fields, issues: failure.issues };
    case "http_error":
      return { ...fields, http_status: failure.http_status };
    case "request_failed":
      return { ...fields, cause: failure.cause };
    case "timeout":
      return fields;
  }
}

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
    record_type,
    signal,
  }: {
    domain: string;
    record_type: RecordType;
    signal: AbortSignal;
  }): Promise<Result<DnsResponse, DnsFailure>> {
    const query = new URLSearchParams({
      name: domain,
      type: record_type,
    }).toString();
    const url = `https://dns.google/resolve?${query}`;
    let body: unknown;
    try {
      const res = await fetch(url, { signal });
      if (!res.ok)
        return err({
          domain,
          http_status: res.status,
          kind: "http_error",
          record_type,
        });
      body = await res.json();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "TimeoutError")
        return err({ domain, kind: "timeout", record_type });
      return err({ cause, domain, kind: "request_failed", record_type });
    }
    const parsed = dns_response_schema.safeParse(body);
    if (!parsed.success)
      return err({
        domain,
        issues: parsed.error.issues,
        kind: "bad_response",
        record_type,
      });
    return ok(parsed.data);
  }

  async function check({
    domain,
    signal,
  }: {
    domain: string;
    signal: AbortSignal;
  }): Promise<
    Result<
      { readonly reachability: Reachability; readonly record_type: RecordType },
      DnsFailure
    >
  > {
    const mx = await resolve({ domain, record_type: "MX", signal });
    if (!mx.ok) return mx;
    const after_mx = decide_from_mx(mx.value);
    if (after_mx.kind !== "no_mx")
      return ok({ reachability: after_mx, record_type: "MX" });
    const a = await resolve({ domain, record_type: "A", signal });
    if (!a.ok) return a;
    return ok({ reachability: decide_from_a(a.value), record_type: "A" });
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
          const checked = await check({ domain, signal });
          if (!checked.ok) {
            failure ??= checked.error;
            stop.abort();
            return;
          }
          const { reachability, record_type } = checked.value;
          switch (reachability.kind) {
            case "reachable":
              log("debug", {
                domain,
                event: "dns.domain.reachable",
                record_type,
              });
              break;
            case "unreachable":
              log("debug", {
                domain,
                event: "dns.domain.unreachable",
                reason: reachability.reason,
                record_type,
              });
              unreachable.add(domain);
              break;
          }
        }
      }),
    );
    if (failure !== undefined) {
      log("error", dns_lookup_failed_fields(failure));
      return err(failure);
    }
    return ok(domains.filter((domain) => unreachable.has(domain)));
  };
}
