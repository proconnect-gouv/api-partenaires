import { z } from "zod";

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

type Fetch = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

export function create_find_unreachable_domains({ fetch }: { fetch: Fetch }) {
  async function resolve(name: string, type: "A" | "MX", signal: AbortSignal) {
    const res = await fetch(
      `https://dns.google/resolve?${new URLSearchParams({ name, type })}`,
      { signal },
    );
    if (!res.ok) throw new Error(`dns.google ${type} ${name}: ${res.status}`);
    return dns_response_schema.parse(await res.json());
  }

  async function is_domain_reachable(domain: string) {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const mx = await resolve(domain, "MX", signal);
    const mx_records = (mx.Answer ?? []).filter(({ type }) => type === MX);
    if (mx_records.some(({ data }) => data === NULL_MX)) return false;
    if (mx_records.length > 0) return true;
    if (mx.Status === NXDOMAIN) return false;
    const a = await resolve(domain, "A", signal);
    return (a.Answer ?? []).some(({ type }) => type === A);
  }

  return async function find_unreachable_domains(domains: string[]) {
    const queue = [...domains];
    const unreachable = new Set<string>();
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        try {
          for (let domain; (domain = queue.shift());)
            if (!(await is_domain_reachable(domain))) unreachable.add(domain);
        } catch (error) {
          queue.length = 0;
          throw error;
        }
      }),
    );
    return domains.filter((domain) => unreachable.has(domain));
  };
}
