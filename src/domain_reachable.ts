import { z } from "zod";

const NXDOMAIN = 3;
const dns_response_schema = z.object({
  Answer: z.array(z.unknown()).optional(),
  Status: z.number(),
});

export async function is_domain_reachable(domain: string) {
  const mx = await resolve(domain, "MX");
  if (mx.Answer?.length) return true;
  if (mx.Status === NXDOMAIN) return false;
  const a = await resolve(domain, "A");
  return Boolean(a.Answer?.length);
}

async function resolve(name: string, type: "A" | "MX") {
  const res = await fetch(
    `https://dns.google/resolve?${new URLSearchParams({ name, type })}`,
  );
  return dns_response_schema.parse(await res.json());
}
