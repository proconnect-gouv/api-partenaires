export const SOVEREIGN_EXTENSIONS: ReadonlySet<string> = new Set([
  "alsace",
  "bzh",
  "corsica",
  "eu",
  "fr",
  "gf",
  "gp",
  "mq",
  "nc",
  "paris",
  "pf",
  "pm",
  "re",
  "tf",
  "wf",
  "yt",
]);

// Not RPNT 1.2, but a commune that registered vernou-en-sologne.com in 2004 still owns the name.
export const RECONSTRUCTIBLE_EXTENSIONS: ReadonlySet<string> = new Set([
  ...SOVEREIGN_EXTENSIONS,
  "com",
  "info",
  "net",
  "org",
]);
