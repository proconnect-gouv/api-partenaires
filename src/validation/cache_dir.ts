import { homedir } from "node:os";
import { join } from "node:path";

export function default_cache_dir(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(base, "proconnect-allowlist");
}
