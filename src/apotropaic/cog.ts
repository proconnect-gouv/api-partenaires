import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { default_cache_dir } from "#src/apotropaic/cache_dir";

const INSEE_COG_URL =
  "https://www.insee.fr/fr/statistiques/fichier/8740222/v_commune_2026.csv";

type FetchLike = (url: string) => Promise<Response>;

export type LoadCogExportOptions = {
  cache_dir?: string;
  fetch?: FetchLike;
};

export async function load_cog_export(
  options: LoadCogExportOptions = {},
): Promise<string> {
  const { cache_dir = default_cache_dir(), fetch: fetch_impl = fetch } =
    options;

  const cache_path = join(cache_dir, INSEE_COG_URL.split("/").at(-1)!);
  const cache_file = Bun.file(cache_path);

  if (await cache_file.exists()) {
    console.log(`🗺️ INSEE COG: cache hit (${cache_path})`);
    return cache_file.text();
  }

  console.log(`🗺️ INSEE COG: cache miss, fetching ${INSEE_COG_URL}`);
  const response = await fetch_impl(INSEE_COG_URL);
  if (!response.ok) {
    throw new Error(
      `failed to fetch INSEE COG: ${response.status} ${response.statusText}`,
    );
  }
  const body = await response.text();

  await mkdir(cache_dir, { recursive: true });
  await Bun.write(cache_path, body);

  return body;
}

// INSEE commune code: département (2 digits, or 2A/2B for Corsica) + 3 digits: 01001, 2A004, 97101.
const insee_code_schema = z.string().regex(/^(\d{2}|2[AB])\d{3}$/);

const cog_row_schema = z
  .object({
    COM: insee_code_schema,
    COMPARENT: z.union([z.literal(""), insee_code_schema]),
    LIBELLE: z.string().min(1),
    NCCENR: z.string().min(1),
  })
  .transform(({ COM, COMPARENT, LIBELLE, NCCENR }) => ({
    codes: [COM, COMPARENT].filter(Boolean),
    spellings: [LIBELLE, NCCENR],
  }));

const cog_csv_schema = z
  .string()
  .transform((csv) => {
    const [header = [], ...cells] = csv
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(Boolean)
      // Every INSEE field is double-quoted, "" escapes a quote: "COM","01001","".
      .map((line) =>
        [...line.matchAll(/"((?:[^"]|"")*)"/g)].map(([, value = ""]) =>
          value.replaceAll('""', '"'),
        ),
      );
    return cells.map((row) =>
      Object.fromEntries(header.map((column, index) => [column, row[index]])),
    );
  })
  .pipe(z.array(cog_row_schema));

export function build_cog_names(
  csv: string,
): ReadonlyMap<string, ReadonlySet<string>> {
  const names = new Map<string, Set<string>>();
  for (const { codes, spellings } of cog_csv_schema.parse(csv)) {
    for (const code of codes) {
      names.set(code, new Set([...(names.get(code) ?? []), ...spellings]));
    }
  }
  return names;
}
