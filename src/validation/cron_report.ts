import { createHash } from "node:crypto";

import { z } from "zod";

import { table } from "./markdown";
import type { RefusedRow } from "./refused";

const DILA_RECORDS =
  "https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?select=id%2Cnom%2Csite_internet%2Cadresse_courriel&where=";
const LOG_TAIL_LINES = 40;
const SIGNATURE_LINE = /^(error:|🚨)/;
const WORKFLOW = ".github/workflows/apotropaic-cron.yml";

export const provenance_schema = z.object({
  actor: z.string(),
  attempt: z.string(),
  event: z.string(),
  ref: z.string(),
  repository: z.string(),
  run_id: z.string(),
  run_number: z.string(),
  server_url: z.string(),
  sha: z.string(),
});

export type Provenance = z.infer<typeof provenance_schema>;

function noun(n: number, one: string, other: string): string {
  return `${n} ${n === 1 ? one : other}`;
}

function links(provenance: Provenance) {
  const repo = `${provenance.server_url}/${provenance.repository}`;
  return {
    repo,
    run: `${repo}/actions/runs/${provenance.run_id}`,
    workflow: `${repo}/blob/${provenance.sha}/${WORKFLOW}`,
  };
}

function provenance_markdown(provenance: Provenance): string {
  const { actor, attempt, event, ref, run_number, sha } = provenance;
  const { repo, run, workflow } = links(provenance);
  return `\n\n---\n<sub>🧾 Provenance: [\`apotropaic-cron.yml\`](${workflow}) · run [#${run_number}](${run}) attempt ${attempt} · \`${event}\` by \`${actor}\` · \`${ref}\` at [\`${sha.slice(0, 7)}\`](${repo}/commit/${sha})</sub>\n`;
}

function provenance_text(provenance: Provenance): string {
  const { actor, attempt, event, ref, sha } = provenance;
  const { run, workflow } = links(provenance);
  return [
    `Workflow: ${workflow}`,
    `Run: ${run} (attempt ${attempt})`,
    `Event: ${event} by ${actor}`,
    `Ref: ${ref} at ${sha}`,
    "",
  ].join("\n");
}

function dila_links({ domain, fiche }: RefusedRow): string {
  const declares = `[who declares it](${DILA_RECORDS}search(%22${domain}%22))`;
  if (fiche === undefined) return declares;
  const id = fiche.split("/").at(-1);
  return `[fiche](${fiche}) · [record](${DILA_RECORDS}id%3D%22${id}%22) · ${declares}`;
}

function rows_table(refused: readonly RefusedRow[]): string {
  return `${table({
    align: ["---", "---", "---", "---", "---"],
    head: ["domain", "provider", "refusal", "DILA", "fix"],
    rows: refused.map((row) => [
      `[\`${row.domain}\`](https://${row.domain})`,
      `\`${row.uid.slice(0, 8)}\``,
      row.refusal,
      dila_links(row),
      row.moved_to === null
        ? "drop"
        : `repoint to [new fiche](${row.moved_to})`,
    ]),
  })}\n`;
}

function fix_summary(refused: readonly RefusedRow[]): string {
  const repointed = refused.filter(({ moved_to }) => moved_to !== null).length;
  const dropped = refused.length - repointed;
  return [
    ...(repointed > 0 ? [`repoint ${noun(repointed, "row", "rows")}`] : []),
    ...(dropped > 0 ? [`drop ${noun(dropped, "row", "rows")}`] : []),
  ].join(" and ");
}

function changeset(refused: readonly RefusedRow[]): string {
  const rows = refused.map(
    ({ domain, moved_to, uid }) =>
      `\`${domain}\` (fournisseur \`${uid.slice(0, 8)}\`) ${moved_to === null ? "retiré" : "pointe vers sa nouvelle fiche"}`,
  );
  return `Correction de l’allowlist d’après l’annuaire DILA : ${rows.join(", ")}.\n`;
}

export function lint_signature(lint_log: string): string {
  const lines = lint_log
    .split("\n")
    .filter((line) => SIGNATURE_LINE.test(line))
    .map((line) => `${line}\n`)
    .join("");
  return createHash("sha256").update(lines).digest("hex").slice(0, 16);
}

function log_tail(lint_log: string): string {
  return lint_log
    .split("\n")
    .filter((line) => !/^(\s*$|::)/.test(line))
    .slice(-LOG_TAIL_LINES)
    .join("\n");
}

export function render_cron_report({
  explain_log,
  lint_log,
  pr_url,
  provenance,
  refused,
  team,
}: {
  explain_log: string;
  lint_log: string;
  pr_url: string | null;
  provenance: Provenance;
  refused: readonly RefusedRow[];
  team: string;
}) {
  const { repo, run } = links(provenance);
  const footer = provenance_markdown(provenance);
  const rows = rows_table(refused);
  const signature = lint_signature(lint_log);
  const title = `🔧 ${fix_summary(refused)} DILA refuses`;
  const pr = [
    `${team}: today's DILA export refuses ${noun(refused.length, "allowlisted row", "allowlisted rows")}, so the apotropaic cron failed ([run](${run})).`,
    "",
    "This pull request fixes them: a row whose fiche DILA re-filed under a new id, same SIREN, is repointed to that fiche; any other row is dropped. The allowlist lints clean afterwards. A dropped domain can come back once its collectivité's fiche lists it again.",
    "",
    rows,
    "<details><summary><code>bun run explain:domain</code></summary>",
    "",
    "```text",
    explain_log.trimEnd(),
    "```",
    "</details>",
  ].join("\n");
  const issue = [
    `<!-- signature: ${signature} -->`,
    `${team}: the apotropaic cron failed on \`${provenance.ref}\` ([run](${run})).`,
    "",
    pr_url === null
      ? "No automatic fix: read the log below, then `bun run explain:domain <domain>` for refused rows."
      : `Fix proposed in ${pr_url}: repoint or drop the rows DILA refuses.`,
    "",
    ...(refused.length > 0 ? [rows] : []),
    `<details><summary>Log, commit <a href="${repo}/commit/${provenance.sha}"><code>${provenance.sha.slice(0, 7)}</code></a></summary>`,
    "",
    "```text",
    log_tail(lint_log),
    "```",
    "</details>",
  ].join("\n");
  return {
    changeset: changeset(refused),
    closed: `✅ The apotropaic cron is green again ([run](${run})).${footer}`,
    issue: `${issue}${footer}`,
    message: `${title}\n\n${provenance_text(provenance)}`,
    pr: `${pr}${footer}`,
    rows,
    signature,
    summary: `## ${title}\n\n${pr}${footer}`,
    title,
  };
}
