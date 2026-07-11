import { useEffect, useState } from "react";
import Header from "./components/Header";
import FocusMode from "./components/FocusMode";
import AddLimitForm from "./components/AddLimitForm";
import AssignSiteForm from "./components/AssignSiteForm";
import TimeLimitsSection from "./components/TimeLimitsSection";
import CategoryAssignmentsList from "./components/CategoryAssignmentsList";
import UsageSection from "./components/UsageSection";
import type {
  BackgroundMessage,
  CategoriesMap,
  EditTarget,
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
  loadFocusEnd,
  saveFocusEnd,
  isFocusLocked,
  requestUsage,
} from "./shared/storage";
import type { BundledCategories } from "./shared/categories";
import { EMPTY_BUNDLED, loadBundledCategories } from "./shared/categories";

export default function App() {
  const [limits, setLimits] = useState<LimitsMap>({});
  const [usage, setUsage] = useState<UsageMap>({});
  const [categories, setCategories] = useState<CategoriesMap>({});
  const [siteCategories, setSiteCategories] = useState<SiteCategoriesMap>({});
  const [bundled, setBundled] = useState<BundledCategories>(EMPTY_BUNDLED);
  const [focusEnd, setFocusEnd] = useState(0);
  // which entry an edit icon opened for editing (null = not editing)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // ticking clock so the focus countdown is live and the lock lifts the
  // moment the timer runs out, without reopening the popup
  const [now, setNow] = useState(() => Date.now());
  const focusLocked = focusEnd > now;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // initial load: limits/overrides from storage, usage from the background
    loadLimits().then(setLimits);
    loadSiteCategories().then(setSiteCategories);
    loadBundledCategories().then(setBundled);
    loadFocusEnd().then(setFocusEnd);
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

  // every mutating handler re-checks focus mode against STORAGE at save time
  // (not just React state), so limits stay un-modifiable during focus mode no
  // matter what state the popup UI is in. returns true if the save must be
  // dropped, and syncs the lock into view state so the forms disappear.
  async function refuseWhileFocused(): Promise<boolean> {
    if (!(await isFocusLocked())) return false;
    setFocusEnd(await loadFocusEnd());
    return true;
  }

  async function handleSetLimit(
    website: string,
    limitSeconds: number,
    redirect: string,
    blocked: boolean
  ) {
    if (await refuseWhileFocused()) return;
    const current = await loadLimits();
    // keep any usage already tracked for this site today
    const existingUsage = current[website]?.timeUsage ?? 0;
    const entry: SiteLimit = {
      websiteName: website,
      timeLimit: limitSeconds,
      timeUsage: existingUsage,
      redirect: redirect || "",
      blocked,
    };
    const updated = { ...current, [website]: entry };
    await saveLimits(updated);
    setLimits(updated);
  }

  async function handleSetCategoryLimit(
    category: string,
    limitSeconds: number,
    redirect: string
  ) {
    if (await refuseWhileFocused()) return;
    const current = await loadCategories();
    // usage isn't stored on the category -- the background derives it from
    // the sites in the category, so a new limit starts at today's real usage
    const updated: CategoriesMap = {
      ...current,
      [category]: { name: category, timeLimit: limitSeconds, timeUsage: 0, redirect },
    };
    await saveCategories(updated);
    // re-request so the derived usage (seeded from existing site usage) shows
    const payload = await requestUsage();
    setCategories(payload.categories);
  }

  // category === undefined removes the override; null = explicitly uncategorized
  async function handleAssignSite(host: string, category: string | null | undefined) {
    if (await refuseWhileFocused()) return;
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
    if (await refuseWhileFocused()) return;
    const current = await loadLimits();
    const cleared: LimitsMap = {};
    for (const [host, entry] of Object.entries(current)) {
      cleared[host] = { ...entry, timeLimit: 0, redirect: "", blocked: false };
    }
    await saveLimits(cleared);
    await saveCategories({});
    setLimits(cleared);
    setCategories({});
  }

  async function handleStartFocus(durationSeconds: number) {
    // if somehow already focused, never let a new start SHORTEN the lock
    const existing = await loadFocusEnd();
    const end = Math.max(existing, Date.now() + durationSeconds * 1000);
    await saveFocusEnd(end);
    setFocusEnd(end);
    setNow(Date.now());
    // any in-progress edit is void once limits are locked
    setEditTarget(null);
  }

  return (
    <>
      <Header />
      <div className="button-row">
        <FocusMode focusEnd={focusEnd} now={now} onStart={handleStartFocus} />
        {!focusLocked && (
          <>
            <AddLimitForm
              limits={limits}
              categories={categories}
              siteCategories={siteCategories}
              bundled={bundled}
              onSetLimit={handleSetLimit}
              onSetCategoryLimit={handleSetCategoryLimit}
              editTarget={editTarget}
              onEditDone={() => setEditTarget(null)}
            />
            <AssignSiteForm onAssignSite={handleAssignSite} />
          </>
        )}
      </div>
      <TimeLimitsSection
        limits={limits}
        categories={categories}
        bundled={bundled}
        onEditSite={(host) => setEditTarget({ kind: "site", host })}
        onEditCategory={(category) => setEditTarget({ kind: "category", category })}
        onReset={handleReset}
        focusLocked={focusLocked}
      />
      <CategoryAssignmentsList siteCategories={siteCategories} bundled={bundled} />
      <UsageSection
        usage={usage}
        limits={limits}
        categories={categories}
        siteCategories={siteCategories}
        bundled={bundled}
      />
    </>
  );
}
