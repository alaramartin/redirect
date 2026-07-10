import { useEffect, useState } from "react";
import Header from "./components/Header";
import LimitForm from "./components/LimitForm";
import LimitsList from "./components/LimitsList";
import UsageList from "./components/UsageList";
import type { BackgroundMessage, LimitsMap, SiteLimit, UsageMap } from "./shared/types";
import { loadLimits, saveLimits, requestUsage } from "./shared/storage";

export default function App() {
  const [limits, setLimits] = useState<LimitsMap>({});
  const [usage, setUsage] = useState<UsageMap>({});

  useEffect(() => {
    // initial load: limits from storage, usage from the background
    loadLimits().then(setLimits);
    requestUsage().then(setUsage);

    // live updates pushed by the background while the popup is open
    const listener = (message: BackgroundMessage) => {
      if (message.action === "list-of-screen-time") {
        setUsage(message.data);
      }
      if (message.action === "reset-usage") {
        requestUsage().then(setUsage);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function handleSetLimit(website: string, limitSeconds: number, redirect: string) {
    const current = await loadLimits();
    // keep any usage already tracked for this site today
    const existingUsage = current[website]?.timeUsage ?? 0;
    const entry: SiteLimit = {
      websiteName: website,
      timeLimit: limitSeconds,
      timeUsage: existingUsage,
      redirect: redirect || "",
    };
    const updated = { ...current, [website]: entry };
    await saveLimits(updated);
    setLimits(updated);
  }

  // deletes all saved limits
  async function handleReset() {
    await saveLimits({});
    setLimits({});
  }

  return (
    <>
      <Header />
      <LimitForm onSetLimit={handleSetLimit} />
      <LimitsList limits={limits} onReset={handleReset} />
      <UsageList usage={usage} />
    </>
  );
}
