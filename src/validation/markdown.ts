const tty = process.stdout.isTTY ?? false;

export function md(markdown: string): string {
  return Bun.markdown
    .ansi(markdown, {
      colors: tty,
      columns: tty ? process.stdout.columns : 0,
      hyperlinks: tty,
    })
    .trimEnd();
}

export function table({
  align,
  head,
  rows,
}: {
  align: string[];
  head: string[];
  rows: string[][];
}): string {
  return [
    head,
    align,
    ...rows.map((row) => row.map((cell) => cell.replaceAll("|", "\\|"))),
  ]
    .map((cells) => `| ${cells.join(" | ")} |`)
    .join("\n");
}

export function code(values: Iterable<string>): string[] {
  return [...values].map((value) => `\`${value}\``);
}
