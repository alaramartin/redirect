import { useEffect, useState } from "react";
import Header from "./components/Header";
import LimitForm from "./components/LimitForm";
import CategoryForm from "./components/CategoryForm";
import AssignSiteForm from "./components/AssignSiteForm";
import LimitsList from "./components/LimitsList";
import CategoryList from "./components/CategoryList";
import UsageList from "./components/UsageList";
import type {
  BackgroundMessage,
  CategoriesMap,
  LimitsMap,
  SiteCategoriesMap,
  SiteLimit,
  UsageMap,
} from "./shared/types";
import {
  loadLimits,
  saveLimits,
  loadCategories,
  saveCategories,
  loadSiteCategories,
  saveSiteCategories,
  requestUsage,
} from "./shared/storage";

export default function App() {
  const [limits, setLimits] = useState<LimitsMap>({});
  const [usage, setUsage] = useState<UsageMap>({});
  const [categories, setCategories] = useState<CategoriesMap>({});
  const [siteCategories, setSiteCategories] = useState<SiteCategoriesMap>({});

  useEffect(() => {
    // initial load: limits/overrides from storage, usage from the background
    loadLimits().then(setLimits);
    loadSiteCategories().then(setSiteCategories);
    requestUsage().then((payload) => {
      setUsage(payload.sites);
      setCategories(payload.categories);
    });

    // live updates pushed by the background while the popup is open
    const listener = (message: BackgroundMessage) => {
      if (message.action === "list-of-screen-time") {
        setUsage(message.data.sites);
        setCategories(message.data.categories);
      }
      if (message.action === "reset-usage") {
        requestUsage().then((payload) => {
          setUsage(payload.sites);
          setCategories(payload.categories);
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // live ticker: this port makes the background push usage (including the
    // in-progress session's seconds) every second while the popup is open
    const port = chrome.runtime.connect({ name: "popup" });
    port.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      port.disconnect();
    };
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

  async function handleSetCategoryLimit(category: string, limitSeconds: number) {
    const current = await loadCategories();
    // usage isn't stored on the category -- the background derives it from
    // the sites in the category, so a new limit starts at today's real usage
    const updated: CategoriesMap = {
      ...current,
      [category]: { name: category, timeLimit: limitSeconds, timeUsage: 0 },
    };
    await saveCategories(updated);
    // re-request so the derived usage (seeded from existing site usage) shows
    const payload = await requestUsage();
    setCategories(payload.categories);
  }

  // category === undefined removes the override; null = explicitly uncategorized
  async function handleAssignSite(host: string, category: string | null | undefined) {
    const current = await loadSiteCategories();
    const updated = { ...current };
    if (category === undefined) {
      delete updated[host];
    } else {
      updated[host] = category;
    }
    await saveSiteCategories(updated);
    setSiteCategories(updated);
    // reassignment moves that site's time between categories -- refresh
    const payload = await requestUsage();
    setCategories(payload.categories);
  }

  // removes every time limit (site + category) but NEVER touches usage
  // tracking -- usage lives on the same site entries, so we zero the limits
  // in place instead of deleting the entries. category assignments are kept
  // too (they're configuration, not limits).
  async function handleReset() {
    const current = await loadLimits();
    const cleared: LimitsMap = {};
    for (const [host, entry] of Object.entries(current)) {
      cleared[host] = { ...entry, timeLimit: 0, redirect: "" };
    }
    await saveLimits(cleared);
    await saveCategories({});
    setLimits(cleared);
    setCategories({});
  }

  return (
    <>
      <Header />
      <LimitForm onSetLimit={handleSetLimit} />
      <CategoryForm onSetCategoryLimit={handleSetCategoryLimit} />
      <AssignSiteForm onAssignSite={handleAssignSite} />
      <LimitsList limits={limits} onReset={handleReset} />
      <CategoryList categories={categories} siteCategories={siteCategories} />
      <UsageList usage={usage} />
    </>
  );
}
