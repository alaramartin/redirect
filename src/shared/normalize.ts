// canonical hostname from whatever the user typed: accepts bare domains
// ("instagram.com"), hosts with www., or full URLs with paths
// ("https://www.instagram.com/feed"). Must match the background's
// normalizeHost (lowercase, no leading www.) so limit keys line up with
// tracked hostnames. Returns null if the input can't become a hostname.
export function normalizeWebsiteInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    // require a dot so a stray word like "instagram" doesn't silently save
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

// canonical LIMIT KEY from user input, like normalizeWebsiteInput but it keeps
// a path so you can limit just one section of a site, e.g. "youtube.com/shorts".
// A rule keyed with a path only governs URLs at or under that path
// ("youtube.com/shorts" also covers "youtube.com/shorts/abc"); the rest of the
// host is unaffected. Bare input (no path, or just "/") returns the bare host,
// identical to normalizeWebsiteInput. Query strings and #fragments are dropped.
// Must mirror the background's resolveTargetKey / normalizePath so keys line up.
export function normalizeWebsiteTarget(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    if (!host.includes(".")) return null;
    const path = url.pathname.replace(/\/+$/, ""); // "" for root, no trailing slash
    return path ? host + path : host;
  } catch {
    return null;
  }
}

// the bare host part of a limit key ("youtube.com/shorts" -> "youtube.com")
export function hostOfKey(key: string): string {
  const i = key.indexOf("/");
  return i === -1 ? key : key.slice(0, i);
}
