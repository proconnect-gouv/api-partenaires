import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";

import { z } from "zod";

import {
  provenance_schema,
  refused_row_schema,
  render_cron_report,
} from "#src/validation";

const { values } = parseArgs({
  options: {
    explain: { type: "string" },
    "lint-log": { type: "string" },
    out: { type: "string" },
    "pr-url": { type: "string" },
    refused: { type: "string" },
  },
});

if (values.out === undefined || values["lint-log"] === undefined) {
  console.error(
    "usage: cron_report.ts --out <dir> --lint-log <file> [--refused <json>] [--explain <file>] [--pr-url <url>]",
  );
  process.exit(2);
}

async function read_text(path: string | undefined): Promise<string> {
  if (path === undefined) return "";
  const file = Bun.file(path);
  return (await file.exists()) ? file.text() : "";
}

const refused_json = (await read_text(values.refused)).trim();
const env = process.env;
const report = render_cron_report({
  explain_log: await read_text(values.explain),
  lint_log: await read_text(values["lint-log"]),
  pr_url: values["pr-url"] || null,
  provenance: provenance_schema.parse({
    actor: env.GITHUB_TRIGGERING_ACTOR,
    attempt: env.GITHUB_RUN_ATTEMPT,
    event: env.GITHUB_EVENT_NAME,
    ref: env.REF,
    repository: env.GITHUB_REPOSITORY,
    run_id: env.GITHUB_RUN_ID,
    run_number: env.GITHUB_RUN_NUMBER,
    server_url: env.GITHUB_SERVER_URL,
    sha: env.SHA,
  }),
  refused:
    refused_json === ""
      ? []
      : z.array(refused_row_schema).parse(JSON.parse(refused_json)),
  team: z.string().parse(env.TEAM),
});

const files = {
  "changeset.md": report.changeset,
  "closed.md": report.closed,
  "issue.md": report.issue,
  "message.txt": report.message,
  "pr.md": report.pr,
  "rows.md": report.rows,
  "signature.txt": report.signature,
  "summary.md": report.summary,
  "title.txt": report.title,
};

await mkdir(values.out, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  await Bun.write(`${values.out}/${name}`, content);
}
