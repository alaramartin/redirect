import type { LimitsMap, UsageMap } from "./types";

export async function loadLimits(): Promise<LimitsMap> {
  const result = await chrome.storage.local.get("limits");
  return (result.limits as LimitsMap) ?? {};
}

export async function saveLimits(limits: LimitsMap): Promise<void> {
  await chrome.storage.local.set({ limits });
}

// ask the background for today's usage; it checks for a missed daily
// reset before responding, so this is always fresh
export async function requestUsage(): Promise<UsageMap> {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getScreenTime" });
    return (response?.data as UsageMap) ?? {};
  } catch {
    return {};
  }
}
