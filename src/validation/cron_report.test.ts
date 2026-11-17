import { describe, expect, test } from "bun:test";

import { lint_signature, render_cron_report } from "./cron_report";
import type { RefusedRow } from "./refused";

const old_fiche =
  "https://lannuaire.service-public.gouv.fr/normandie/manche/8d9c336e-19dc-4e33-ad4f-ca4efccd5d55";
const new_fiche =
  "https://lannuaire.service-public.gouv.fr/normandie/manche/8bb65ac2-f71f-4ddf-942d-1a363cb32983";

const repointed: RefusedRow = {
  domain: "la-haye.fr",
  fiche: old_fiche,
  moved_to: new_fiche,
  refusal: "fiche is not a collectivite in DILA",
  uid: "f5154035-0000-4000-8000-000000000000",
};

function dropped(domain: string): RefusedRow {
  return {
    domain,
    moved_to: null,
    refusal: "no collectivite declares it in DILA",
    uid: "a1b2c3d4-0000-4000-8000-000000000000",
  };
}

function report(refused: RefusedRow[]) {
  return render_cron_report({
    explain_log: "",
    lint_log: "",
    pr_url: null,
    provenance: {
      actor: "douglasduteil",
      attempt: "1",
      event: "schedule",
      ref: "main",
      repository: "proconnect-gouv/api-partenaires",
      run_id: "44078922066",
      run_number: "66",
      server_url: "https://github.com",
      sha: "21cdd5725d23ac52514f94954177191534278d1c",
    },
    refused,
    team: "@proconnect-gouv/developers",
  });
}

describe("render_cron_report", () => {
  test("titles the fix by what it does to each row, singular or plural", () => {
    expect(report([repointed]).title).toBe("🔧 repoint 1 row DILA refuses");
    expect(report([dropped("a.fr"), dropped("b.fr")]).title).toBe(
      "🔧 drop 2 rows DILA refuses",
    );
    expect(report([repointed, dropped("a.fr")]).title).toBe(
      "🔧 repoint 1 row and drop 1 row DILA refuses",
    );
  });

  test("tells per row whether it is repointed or dropped, with its DILA links", () => {
    expect(report([repointed, dropped("a.fr")]).rows).toBe(
      [
        "| domain | provider | refusal | DILA | fix |",
        "| --- | --- | --- | --- | --- |",
        `| [\`la-haye.fr\`](https://la-haye.fr) | \`f5154035\` | fiche is not a collectivite in DILA | [fiche](${old_fiche}) · [record](https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?select=id%2Cnom%2Csite_internet%2Cadresse_courriel&where=id%3D%228d9c336e-19dc-4e33-ad4f-ca4efccd5d55%22) · [who declares it](https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?select=id%2Cnom%2Csite_internet%2Cadresse_courriel&where=search(%22la-haye.fr%22)) | repoint to [new fiche](${new_fiche}) |`,
        "| [`a.fr`](https://a.fr) | `a1b2c3d4` | no collectivite declares it in DILA | [who declares it](https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?select=id%2Cnom%2Csite_internet%2Cadresse_courriel&where=search(%22a.fr%22)) | drop |",
        "",
      ].join("\n"),
    );
  });

  test("writes the release note in French, one clause per row", () => {
    expect(report([repointed, dropped("a.fr")]).changeset).toBe(
      "Correction de l’allowlist d’après l’annuaire DILA : `la-haye.fr` (fournisseur `f5154035`) pointe vers sa nouvelle fiche, `a.fr` (fournisseur `a1b2c3d4`) retiré.\n",
    );
  });

  test("counts refused rows in the pull request's first sentence", () => {
    expect(report([repointed]).pr).toStartWith(
      "@proconnect-gouv/developers: today's DILA export refuses 1 allowlisted row, so the apotropaic cron failed ([run](https://github.com/proconnect-gouv/api-partenaires/actions/runs/44078922066)).",
    );
  });
});

describe("lint_signature", () => {
  test("depends only on the error lines of the log", () => {
    const errors = "🚨 config: has refused rows\nerror: script exited";
    expect(lint_signature(`🗓️ cache hit\n${errors}\n`)).toBe(
      lint_signature(`🗓️ cache miss, downloaded\n${errors}\n`),
    );
    expect(lint_signature(errors)).not.toBe(lint_signature("🚨 other"));
  });

  test("keeps the signatures already posted on open issues", () => {
    expect(lint_signature("x\n🚨 a\nerror: b\n")).toBe("ac9924a130cbe1ba");
    expect(lint_signature("no errors\n")).toBe("e3b0c44298fc1c14");
  });
});
