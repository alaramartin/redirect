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
