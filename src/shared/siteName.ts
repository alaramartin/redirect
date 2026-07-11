import type { BundledCategories } from "./categories";
import { hostOfKey } from "./normalize";

// friendly label for a tracked key -- only applies to bare-host mappings
// bundled in public/categories.json (exact match, or a subdomain suffix
// match so "m.youtube.com" resolves via "youtube.com"). a path-scoped key
// (e.g. "youtube.com/shorts") always shows as the raw URL, never the host's
// mapped name -- it's a different, more specific thing being tracked. any
// bare host without a bundled mapping also falls back to the raw URL: no
// guessed/derived names.
export function displayName(key: string, bundled: BundledCategories): string {
  const host = hostOfKey(key);
  if (host !== key) return key; // path-scoped: always the raw URL
  return lookupName(host, bundled) ?? key;
}

function lookupName(host: string, bundled: BundledCategories): string | undefined {
  if (host in bundled.names) return bundled.names[host];
  for (const [domain, name] of Object.entries(bundled.names)) {
    if (host.endsWith("." + domain)) return name;
  }
  return undefined;
}
