import { z } from "zod";

import {
  type Fetch,
  http_failure_fields,
  type HttpFailure,
  read_response_body,
  safe_fetch,
} from "#src/api/http";
import { log } from "#src/api/log";
import { assert_never, err, ok, type Result } from "#src/utils";

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
} & HttpFailure;

export type FindUnreachableDomains = (
  domains: readonly string[],
) => Promise<Result<readonly string[], DnsFailure>>;

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
    const response = await safe_fetch({
      fetch,
      init: { redirect: "error", signal },
      url,
    });
    if (!response.ok) return err({ ...response.error, domain, record_type });
    const body = await read_response_body({
      parse: JSON.parse,
      response: response.value,
      url,
    });
    if (!body.ok) return err({ ...body.error, domain, record_type });
    const parsed = dns_response_schema.safeParse(body.value);
    if (!parsed.success)
      return err({
        cause: parsed.error,
        domain,
        kind: "bad_response",
        record_type,
        url,
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
            default:
              assert_never(reachability);
          }
        }
      }),
    );
    if (failure !== undefined) {
      log("error", {
        domain: failure.domain,
        event: "dns.lookup.failed",
        record_type: failure.record_type,
        ...http_failure_fields(failure),
      });
      return err(failure);
    }
    return ok(domains.filter((domain) => unreachable.has(domain)));
  };
}
