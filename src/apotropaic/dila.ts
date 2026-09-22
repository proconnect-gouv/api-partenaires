import { mkdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DILA_EXPORT_URL =
  "https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/" +
  "datasets/api-lannuaire-administration/exports/json" +
  "?select=id%2Csiret%2Csiren%2Cnom%2Cpivot%2Ccode_insee_commune" +
  "%2Csite_internet%2Cadresse_courriel";

function default_cache_dir(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(base, "proconnect-allowlist");
}

type FetchLike = (url: string) => Promise<Response>;

export type LoadDilaExportOptions = {
  fetch?: FetchLike;
  cache_dir?: string;
  today?: Date;
};

export async function load_dila_export(
  options: LoadDilaExportOptions = {},
): Promise<unknown> {
  const {
    fetch: fetch_impl = fetch,
    cache_dir = default_cache_dir(),
    today = new Date(),
  } = options;

  const date_key = today.toISOString().slice(0, 10);
  const cache_path = join(cache_dir, `dila-${date_key}.json`);
  const cache_file = Bun.file(cache_path);

  if (await cache_file.exists()) {
    const cached = await cache_file.text();
    if (cached.length > 0) {
      return JSON.parse(cached);
    }
  }

  const response = await fetch_impl(DILA_EXPORT_URL);
  if (!response.ok) {
    throw new Error(
      `failed to fetch DILA export: ${response.status} ${response.statusText}`,
    );
  }
  const body = await response.text();

  await mkdir(cache_dir, { recursive: true });
  const temp_path = `${cache_path}.part`;
  await Bun.write(temp_path, body);
  await rename(temp_path, cache_path);

  return JSON.parse(body);
}
