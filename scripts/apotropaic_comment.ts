import { digest_schema, render_digest } from "#src/apotropaic/digest";
import { zod_issues } from "#src/zod_issues";

const MARKER = "<!-- apotropaic-digest -->";
const MAX_BYTES = 1024 * 1024;
const RUN_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/;

const [path, expected_head_sha, run_url] = process.argv.slice(2);
if (path === undefined || expected_head_sha === undefined) {
  console.error(
    "usage: apotropaic_comment.ts <digest.json> <head-sha> [run-url]",
  );
  process.exit(2);
}

const file = Bun.file(path);
if (file.size > MAX_BYTES) {
  console.error(`🚨 ${path}: ${file.size} bytes, over ${MAX_BYTES}`);
  process.exit(1);
}

let json: unknown;
try {
  json = JSON.parse(await file.text());
} catch {
  console.error(`🚨 ${path}: not JSON`);
  process.exit(1);
}

const parsed = digest_schema.safeParse(json);
if (!parsed.success) {
  console.error(`🚨 ${path}: not a digest`);
  for (const issue of zod_issues(parsed.error)) {
    console.error(`  ${issue}`);
  }
  process.exit(1);
}
if (parsed.data.head_sha !== expected_head_sha) {
  console.error(
    `🚨 ${path}: digest of ${parsed.data.head_sha}, run of ${expected_head_sha}`,
  );
  process.exit(1);
}

const source =
  run_url !== undefined && RUN_URL.test(run_url)
    ? `Full report: [🛡️ Lint allowlist run](${run_url}).`
    : "Full report: the 🛡️ Lint allowlist run summary.";
console.log([MARKER, render_digest(parsed.data), source].join("\n\n"));
