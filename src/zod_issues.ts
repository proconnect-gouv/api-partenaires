import { z } from "zod";

const MAX_ISSUES = 20;

export function zod_issues(error: z.ZodError): string[] {
  const issues = error.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${where}: ${issue.message}`;
  });
  if (issues.length <= MAX_ISSUES) return issues;
  return [
    ...issues.slice(0, MAX_ISSUES),
    `… and ${issues.length - MAX_ISSUES} more issues`,
  ];
}
