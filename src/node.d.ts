/**
 * Minimal ambient declarations for the handful of Node.js built-ins this
 * project uses. Declaring them in-repo keeps `typescript` the only
 * devDependency (no `@types/node`); the surface below is intentionally
 * restricted to exactly what `src/` calls, so a typo against a real Node
 * API still fails to compile.
 */

declare module "node:fs" {
  /** Reading fd 0 (stdin) is the `readFileSync(0, "utf8")` overload. */
  export function readFileSync(path: string | number, encoding: "utf8"): string;
  export function writeFileSync(path: string, data: string): void;
}

declare module "node:path" {
  export function extname(p: string): string;
}

declare var process: {
  argv: string[];
  exit(code?: number): never;
  stdout: { write(chunk: string): boolean };
  stderr: { write(chunk: string): boolean };
};
