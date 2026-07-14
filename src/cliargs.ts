/**
 * A tiny, dependency-free argv parser.
 *
 * Two properties matter for tablewright and rule out `utils.parseArgs`:
 * repeatable operation flags must be preserved **in argv order** (so
 * `edit --set B2=x --del-row 3` applies left to right), and unknown
 * options must be hard errors with usage-friendly messages.
 */

export interface FlagSpec {
  /** Long form including dashes, e.g. `--write`. */
  name: string;
  /** Optional short alias, e.g. `-w`. */
  alias?: string;
  /** Whether the flag consumes a value (`--by Price`, `--by=Price`). */
  takesValue: boolean;
}

export interface ParsedArgs {
  /** Non-flag arguments in order. */
  positionals: string[];
  /** Last value per flag (long name → value; boolean flags map to true). */
  flags: Map<string, string | boolean>;
  /** Every flag occurrence in argv order (for ordered operations). */
  ordered: Array<{ name: string; value: string | boolean }>;
}

/** Parse argv against a spec list. Throws on unknown or malformed flags. */
export function parseArgs(argv: string[], specs: FlagSpec[]): ParsedArgs {
  const byName = new Map<string, FlagSpec>();
  for (const spec of specs) {
    byName.set(spec.name, spec);
    if (spec.alias) byName.set(spec.alias, spec);
  }

  const out: ParsedArgs = { positionals: [], flags: new Map(), ordered: [] };
  let literal = false;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (literal || token === "-" || !token.startsWith("-")) {
      out.positionals.push(token);
      continue;
    }
    if (token === "--") {
      literal = true;
      continue;
    }
    const eq = token.indexOf("=");
    const name = eq === -1 ? token : token.slice(0, eq);
    const spec = byName.get(name);
    if (!spec) {
      throw new Error(`unknown option "${name}"`);
    }
    let value: string | boolean;
    if (spec.takesValue) {
      if (eq !== -1) {
        value = token.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined) {
          throw new Error(`option "${spec.name}" requires a value`);
        }
        value = next;
        i++;
      }
    } else {
      if (eq !== -1) {
        throw new Error(`option "${spec.name}" does not take a value`);
      }
      value = true;
    }
    out.flags.set(spec.name, value);
    out.ordered.push({ name: spec.name, value });
  }
  return out;
}

/** Read a string-valued flag, or `undefined` if absent. */
export function stringFlag(
  parsed: ParsedArgs,
  name: string,
): string | undefined {
  const value = parsed.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

/** Read a boolean flag (absent → false). */
export function boolFlag(parsed: ParsedArgs, name: string): boolean {
  return parsed.flags.get(name) === true;
}

/** Parse the `--table N` selector: a positive integer, default 1. */
export function tableFlag(parsed: ParsedArgs): number {
  const raw = stringFlag(parsed, "--table");
  if (raw === undefined) return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`--table expects a positive integer, got "${raw}"`);
  }
  return n;
}
