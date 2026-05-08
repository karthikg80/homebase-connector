/**
 * Returns the env var value or throws with a descriptive message.
 * Use at module scope (top of a server file) for fail-fast behavior.
 *
 *   const SITE_URL = requireEnv("NEXT_PUBLIC_SITE_URL");
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Asserts multiple env vars are set. Throws once with the full list of
 * missing names, so a single deploy failure surfaces every gap.
 *
 *   assertEnv("NEXT_PUBLIC_SITE_URL", "HOMEBASE_URL", "HOMEBASE_APP_KEY");
 */
export function assertEnv(...names: string[]): void {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
