chrome.runtime.onInstalled.addListener(() => {
  console.log("Service worker activated!");
  initialize();
});

// the alarm alone isn't reliable across browser restarts, so re-initialize on startup too
chrome.runtime.onStartup.addListener(() => {
  console.log("Browser started up");
  initialize();
});

var paused = false;
// deal with user closing the laptop
chrome.idle.onStateChanged.addListener(async state => {
  if (state === "locked") {
    // pause time tracking
    paused = true;
    if (startTime && currentTab) {
      const elapsed = (Date.now() - startTime) / 1000;
      await updateTime(getTabDomain(currentTab), elapsed);
      startTime = null;
    }
  } else if (state === "active") {
    // resume time tracking -- but through the same path as a tab change, so a
    // blocked/over-limit site doesn't get a fresh session (this event also
    // fires after ~60s of no input, not just on unlock) and the block timer
    // is re-armed for sites that still have time left
    paused = false;
    handleWebsiteChange();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getScreenTime") {
    // check for a missed reset first so the popup never shows stale usage
    checkAndReset().then(async () => {
      const limits = await loadLimitsList();
      const cats = await loadCategories();
      const resolve = await makeHostResolver();
      sendResponse({
        data: {
          sites: buildUsageMap(limits),
          categories: buildCategoriesWithUsage(limits, cats, resolve)
        }
      });
    }).catch((err) => {
      console.error("getScreenTime error", err);
      sendResponse({ data: { sites: {}, categories: {} } });
    });
    // tells Chrome you're responding async
    return true;
  }

  if (message.action === "blocked-website") {
    console.log("block.js activated");
  }
});

// get the limits list
async function loadLimitsList() {
  const result = await chrome.storage.local.get("limits");
  if (result.limits == undefined) return {};
  console.log("loadlimlist", result.limits);
  return result.limits;
}

async function saveLimitsList(list) {
  await chrome.storage.local.set({ "limits": list });
}

// ---- categories ----

// bundled domain->category defaults, cached for the life of this service
// worker wake (the file can't change without an extension reload anyway)
let bundledCategories = null;
async function loadBundledCategories() {
  if (bundledCategories) return bundledCategories;
  try {
    const resp = await fetch(chrome.runtime.getURL("categories.json"));
    bundledCategories = await resp.json();
  } catch (e) {
    console.error("couldn't load categories.json", e);
    bundledCategories = { categories: [], domains: {} };
  }
  return bundledCategories;
}

// user-set category limits: { categoryId: { name, timeLimit, timeUsage } },
// an entry exists only once the user sets a limit for that category
async function loadCategories() {
  const result = await chrome.storage.local.get("categories");
  return result.categories || {};
}

// user overrides: { hostname: categoryId | null }, null = explicitly
// uncategorized (beats the bundled default)
async function loadSiteCategories() {
  const result = await chrome.storage.local.get("siteCategories");
  return result.siteCategories || {};
}

// build a synchronous host->category resolver (loads overrides + bundled
// list once, so it can be reused across a whole limits map)
async function makeHostResolver() {
  const overrides = await loadSiteCategories();
  const bundled = await loadBundledCategories();
  // user override first (null = explicitly uncategorized), then the bundled
  // list (suffix match so m.youtube.com matches youtube.com)
  return (host) => {
    if (!host) return null;
    const bare = normalizeHost(host);
    if (bare in overrides) return overrides[bare];
    for (const [domain, category] of Object.entries(bundled.domains || {})) {
      if (bare === domain || bare.endsWith("." + domain)) return category;
    }
    return null;
  };
}

async function getCategoryForHost(host) {
  return (await makeHostResolver())(host);
}

// category usage is DERIVED, not stored: a category's usage is the sum of
// today's usage of every site currently in it -- including sites with their
// own individual limit (they eat the category budget too; they're just not
// BLOCKED by it, see getTimeLeftForHost). that way a newly created category
// limit starts at what's already been used today, and reassigning a site
// moves its time along with it.
function buildCategoriesWithUsage(limsObj, catsObj, resolve) {
  const out = {};
  for (const [id, c] of Object.entries(catsObj || {})) {
    if (!c || typeof c !== "object") continue;
    out[id] = {
      name: c.name,
      timeLimit: Number(c.timeLimit) || 0,
      timeUsage: 0,
      redirect: c.redirect || ""
    };
  }
  for (const [host, entry] of Object.entries(limsObj || {})) {
    if (!entry || typeof entry !== "object") continue;
    const cat = resolve(host);
    if (cat && out[cat]) {
      out[cat].timeUsage += Number(entry.timeUsage) || 0;
    }
  }
  return out;
}

// one-time storage migrations
async function migrate() {
  const result = await chrome.storage.local.get(["schemaVersion", "categories", "siteCategories"]);

  // v2: older installs only have "limits"
  if (!(result.schemaVersion >= 2)) {
    await chrome.storage.local.set({
      schemaVersion: 2,
      categories: result.categories || {},
      siteCategories: result.siteCategories || {}
    });
  }

  // v3: hostnames used to be stored verbatim, so "www.instagram.com" and
  // "instagram.com" were different entries -- merge them under the bare host
  if (!(result.schemaVersion >= 3)) {
    const lims = await loadLimitsList();
    const merged = {};
    for (const [host, entry] of Object.entries(lims)) {
      if (!entry || typeof entry !== "object") continue;
      const bare = normalizeHost(host);
      if (!merged[bare]) {
        merged[bare] = { ...entry, websiteName: bare };
      } else {
        // combine duplicates: usage adds up, strictest limit wins
        merged[bare].timeUsage = (Number(merged[bare].timeUsage) || 0) + (Number(entry.timeUsage) || 0);
        const a = Number(merged[bare].timeLimit) || 0;
        const b = Number(entry.timeLimit) || 0;
        merged[bare].timeLimit = a && b ? Math.min(a, b) : (a || b);
        merged[bare].redirect = merged[bare].redirect || entry.redirect || "";
      }
    }
    const overrides = await loadSiteCategories();
    const normalizedOverrides = {};
    for (const [host, cat] of Object.entries(overrides)) {
      normalizedOverrides[normalizeHost(host)] = cat;
    }
    await chrome.storage.local.set({
      schemaVersion: 3,
      limits: merged,
      siteCategories: normalizedOverrides
    });
  }
}

// does this site have its own individual rule? individual rules override
// category rules in ALL cases: such a site is governed only by its own
// limit/redirect and is carved out of its category's budget entirely
function hasOwnRule(entry) {
  return !!(entry && typeof entry === "object" && (Number(entry.timeLimit) > 0 || entry.blocked));
}

// remaining budget for a host, in milliseconds:
//   -Infinity  -> outright blocked ("block this website completely")
//   <= 0       -> the governing limit (own limit, else category) is exhausted
//   Infinity   -> no limits apply
async function getTimeLeftForHost(host, limsObj) {
  const entry = limsObj ? limsObj[host] : null;
  if (entry && entry.blocked) return -Infinity;

  // individual limit overrides the category: it alone governs this site
  if (hasOwnRule(entry)) {
    return 1000 * (Number(entry.timeLimit) - (Number(entry.timeUsage) || 0));
  }

  const resolve = await makeHostResolver();
  const cat = resolve(host);
  if (cat) {
    const cats = await loadCategories();
    if (cats[cat]) {
      const withUsage = buildCategoriesWithUsage(limsObj, cats, resolve);
      if (withUsage[cat].timeLimit > 0) {
        return 1000 * (withUsage[cat].timeLimit - withUsage[cat].timeUsage);
      }
    }
  }
  return Infinity;
}

// push current usage (sites + categories) to the popup, if it's open
async function notifyPopup(limsObj) {
  const cats = await loadCategories();
  const resolve = await makeHostResolver();
  chrome.runtime.sendMessage({
    action: "list-of-screen-time",
    data: {
      sites: buildUsageMap(limsObj),
      categories: buildCategoriesWithUsage(limsObj, cats, resolve)
    }
  }).catch(() => {}); // popup may not be open
}


let screenTime = {};
let lims = {};
let timeoutId = null;
async function initialize() {
  await migrate();
  lims = await loadLimitsList();
  console.log(screenTime, lims);
  timeoutId = null;

  await ensureDailyReset();

  // send initial
  await notifyPopup(lims);
}

// local calendar date as YYYY-M-D, built from local Date parts so it always
// reflects the user's current timezone (don't use toLocaleDateString -- its
// format depends on locale settings and could change under us)
function getLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// resets all usage if the local calendar date has changed since the last reset.
// because the date is recomputed from the current timezone on every call, this
// handles timezone switches too. a backward timezone jump (crossing the date
// line) makes the date differ and grants one extra reset window -- accepted,
// it errs toward giving the user more time.
// returns true if a reset happened.
async function checkAndReset() {
  const today = getLocalDateString();
  const result = await chrome.storage.local.get("lastResetDate");

  if (!result.lastResetDate) {
    // first run: just record today, nothing to reset
    await chrome.storage.local.set({ "lastResetDate": today });
    return false;
  }

  if (result.lastResetDate === today) return false;

  console.log("new day detected, resetting usage. last reset:", result.lastResetDate);
  lims = await loadLimitsList();
  for (const host of Object.keys(lims || {})) {
    if (lims[host] && typeof lims[host] === "object") {
      lims[host].timeUsage = 0;
    }
  }
  // (category usage is derived from site usage, so zeroing the sites gives
  // every category budget a fresh day too)
  await chrome.storage.local.set({ "limits": lims, "lastResetDate": today });

  // fresh day: cancel any pending block timer and restart the current session
  // so a blocked site becomes usable immediately
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  timeSpent = 0;
  if (startTime != null) startTime = Date.now();

  // tell popup to reset the list of usage
  await notifyPopup(lims);
  return true;
}

// one-shot alarm aimed at the next local midnight. re-armed after every fire
// (and on every service worker wake) so it realigns after DST/timezone changes,
// unlike a fixed 24h period which drifts.
function scheduleMidnightAlarm() {
  chrome.alarms.create("reset-at-midnight", {
    delayInMinutes: getMinutesUntilMidnight()
  });
}

async function ensureDailyReset() {
  await checkAndReset();
  scheduleMidnightAlarm();
}

function getMinutesUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  // midnight of next day
  midnight.setHours(24, 0, 0, 0);
  // making sure it's at least 0.01, in case it fires at midnight
  const minUntilMidnight = Math.max(0.01, ((midnight - now) / 60000).toFixed(2));

  console.log(minUntilMidnight, " minutes until midnight");
  
  return minUntilMidnight;
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "reset-at-midnight") {
    // flush time spent so far to the old day before resetting
    if (!paused && startTime && currentTab) {
      const elapsed = (Date.now() - startTime) / 1000;
      startTime = Date.now();
      await updateTime(getTabDomain(currentTab), elapsed);
    }
    await checkAndReset();
    // re-arm the one-shot alarm for the next local midnight
    scheduleMidnightAlarm();
  }
})

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

// canonical form of a hostname: lowercase, no leading "www." -- limits,
// usage, and overrides are all keyed by this so "instagram.com" and
// "www.instagram.com" are the same site
function normalizeHost(host) {
  if (!host) return host;
  return host.toLowerCase().replace(/^www\./, "");
}

function getTabDomain(tab) {
  // if tab isn't null, return domain name of tab
  if (tab && tab.url) {
    try {
      let urlObj = new URL(tab.url);
      console.log("nothing wrong with url", tab.url);
      return normalizeHost(urlObj.hostname);
    }
    catch (e) {
      console.log("something wrong with url", tab.url);
      console.log("error ", e);
    }
  }
  else {
    console.log("tab was null");
  }
}

// helper to switch the screenTime list to a map of the website : usage
function buildUsageMap(limitsObj) {
  const map = {};
  for (const [host, obj] of Object.entries(limitsObj || {})) {
    map[host] = (obj && obj.timeUsage) ? Number(obj.timeUsage) : 0;
  }
  return map;
}


let currentTab = null;
let timeSpent = 0;
let startTime = null;
// display the list
loadLimitsList().then((l) => notifyPopup(l));

async function updateTime(website, time) {
  if (!website) return;

  lims = await loadLimitsList();

  // if it doesn't exist, make one rq
  if (!lims[website] || typeof lims[website] !== "object") {
    lims[website] = {
      websiteName: website,
      timeLimit: 0,
      timeUsage: 0,
      redirect: ""
    };
  }

  // increment the usage (category budgets pick this up automatically since
  // their usage is derived from site usage)
  const prev = Number(lims[website].timeUsage) || 0;
  lims[website].timeUsage = prev + Number(time || 0);

  await saveLimitsList(lims);
  console.log("upadting time spent for", website);

  // display the list
  await notifyPopup(lims);
}

// saves time spent on the website when tab switched
chrome.tabs.onActivated.addListener(async function(tabId, changeInfo, tab) {
  console.log("onactivated");

  handleWebsiteChange();
});

// if the tab was updated and the website was changed, just act like the tab was changed
chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
  console.log("onupdated");

  // changeInfo.url fires when the navigation commits -- before the page
  // renders -- so an already-over-limit site gets blocked before it shows.
  // "complete" is kept as a fallback (e.g. if the commit-time injection
  // landed too early); the block overlay's guard makes re-blocking a no-op.
  if (changeInfo.url || changeInfo.status === "complete") {
    console.log("changeInfo.url: ", changeInfo.url);
    handleWebsiteChange();
  }
});

async function handleWebsiteChange() {
  // cheap guard on every tab event: catch missed midnights/timezone changes
  await checkAndReset();
  lims = await loadLimitsList();
  let oldTab = currentTab;
  currentTab = await getCurrentTab();
  let currentTabHostname = getTabDomain(currentTab);
  let oldTabHostname = getTabDomain(oldTab);
  if (oldTab) {
    console.log("(updated) Tab changed. Old:", oldTabHostname, "New:", currentTabHostname);
  }
  else {
    console.log("(updated) New tab: ", currentTabHostname);
  }

  // update time spent on previous tab if not timed out/exists
  if (startTime != null) {
    timeSpent += (Date.now() - startTime) / 1000;
    await updateTime(oldTabHostname, timeSpent);
  }
  // clear previous timer if not timed out/exists
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  
  // begin timing new url -- but don't start the session until we know the
  // site isn't already out of time: a blocked site must not accumulate usage
  // while the user sits on it (every flush path reads startTime)
  timeSpent = 0;
  startTime = null;

  // set a timeout timer -> call timeout() when the screen time limit runs out
  // IF THERE IS A TIME LIMIT SET (site or category) or the site is outright
  // blocked (getTimeLeftForHost returns -Infinity for those)
  const timeLeft = await getTimeLeftForHost(currentTabHostname, lims);

  if (timeLeft !== Infinity && timeLeft <= 0) {
    // limit already surpassed: block and leave the session stopped
    console.log("time limit already surpassed");
    await blockSite(currentTab);
    return;
  }

  startTime = Date.now();
  if (timeLeft !== Infinity) {
    console.log("time difference: ", timeLeft);
    // function reference to timeout(), to call after a delay of `timeLeft`
    timeoutId = setTimeout(() => timeout(currentTab), timeLeft);
    console.log("set timeout timer ", timeoutId, " ", currentTabHostname);
  }
}

// block the tab once time is up
async function timeout(tab) {
  // the limit may have been removed or raised since this timer was armed
  // (e.g. the user hit Reset Limits) -- recompute before blocking
  const host = getTabDomain(tab);
  lims = await loadLimitsList();
  let timeLeft = await getTimeLeftForHost(host, lims);

  // include the current session's not-yet-flushed seconds (no-op for the
  // Infinity / -Infinity cases)
  if (timeLeft !== Infinity) {
    const pending = startTime ? (Date.now() - startTime) / 1000 : 0;
    timeLeft -= 1000 * pending;
  }

  if (timeLeft === Infinity) {
    // no limit applies anymore: keep tracking, just drop the stale timer
    console.log("stale block timer for", host, "-- limit no longer set");
    timeoutId = null;
    return;
  }
  if (timeLeft > 1000) {
    // limit was raised meanwhile: re-arm for the new remainder
    console.log("limit changed for", host, "-- re-arming for", timeLeft, "ms");
    timeoutId = setTimeout(() => timeout(tab), timeLeft);
    return;
  }

  await blockSite(tab);
  console.log("timed out ", host, "!");
  // stop tracking time on the website
  await stopTimer();
}

// if timeout() called, stop recording time, update screenTime with screenTime = timeLimit (which should == timeSpent)
async function stopTimer() {
  console.log("received stop-timer");
  let currentTabHostname = getTabDomain(currentTab);
  if (!currentTabHostname) return;

  // startTime can already be null if the session was stopped by a racing
  // tab event -- guard so we never add (Date.now() - null) i.e. NaN
  if (startTime != null) {
    timeSpent += (Date.now() - startTime) / 1000;
  }
  // idk if i need this line but just to make sure it doesn't try to update again once tab changes
  startTime = null;

  lims = await loadLimitsList();
  if (!lims[currentTabHostname] || typeof lims[currentTabHostname] !== "object") {
    lims[currentTabHostname] = {
      websiteName: currentTabHostname,
      timeLimit: 0,
      timeUsage: 0,
      redirect: ""
    };
  }
  lims[currentTabHostname].timeUsage = (Number(lims[currentTabHostname].timeUsage) || 0) + timeSpent;

  // cap site usage at its own limit so the display reads usage == limit
  const limit = Number(lims[currentTabHostname].timeLimit) || 0;
  if (limit > 0 && lims[currentTabHostname].timeUsage > limit) {
    lims[currentTabHostname].timeUsage = limit;
  }

  await saveLimitsList(lims);
  clearTimeout(timeoutId);
  timeoutId = null;

  // notify popup
  await notifyPopup(lims);
}

// inject content script to block access to the site
async function blockSite(tab) {
  const host = getTabDomain(tab);
  console.log("website blocked on ", host);
  // inject content script (await so its countdown entry point exists before
  // we call it below). injectImmediately makes it run right at navigation
  // commit instead of waiting for the page to finish loading
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["block.js"],
    injectImmediately: true
  });
  // inject content script's css file
  await chrome.scripting.insertCSS({
      target: {
        tabId: tab.id,
      },
      files: ["block.css"]
    });

  // if the user specified a redirect, start the 5-second countdown on the
  // block page (it navigates unless the user cancels). individual rules
  // override category rules: a site with its own limit/block uses only its
  // own redirect; a site governed by its category uses the category's.
  const limsNow = await loadLimitsList();
  const entry = limsNow[host];
  let redirect = "";
  if (hasOwnRule(entry)) {
    redirect = entry.redirect ? String(entry.redirect).trim() : "";
  } else {
    const resolve = await makeHostResolver();
    const cat = resolve(host);
    if (cat) {
      const cats = await loadCategories();
      if (cats[cat] && cats[cat].redirect) {
        redirect = String(cats[cat].redirect).trim();
      }
    }
  }
  if (redirect) {
    // users type bare domains like "youtube.com"; without a scheme the
    // navigation would be relative to the blocked site
    const url = redirect.includes("://") ? redirect : "https://" + redirect;

    // runtime check: never start the countdown if the redirect target is
    // itself out of time right now (outright blocked, over its own limit,
    // or over its category budget) -- it would just get blocked on arrival
    let targetHost = null;
    try {
      targetHost = normalizeHost(new URL(url).hostname);
    } catch (e) {
      console.log("invalid redirect url", url);
    }
    if (!targetHost) return;
    const targetTimeLeft = await getTimeLeftForHost(targetHost, limsNow);
    if (targetTimeLeft <= 0) {
      console.log("redirect target", targetHost, "is also blocked -- skipping countdown");
      // tell the user why there's no redirect happening
      const reason = targetTimeLeft === -Infinity
        ? "blocked completely"
        : "also out of time right now";
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => {
          if (window.__showRedirectSkippedNotice) window.__showRedirectSkippedNotice(text);
        },
        args: [`Your configured redirect website, ${targetHost}, is ${reason}.`],
        injectImmediately: true
      });
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (u) => {
        if (window.__startRedirectCountdown) window.__startRedirectCountdown(u);
      },
      args: [url],
      injectImmediately: true
    });
  }
}

// live ticker: while the popup is open it connects a port, and we push a
// display update every second that includes the current session's not-yet-
// flushed seconds. display only -- storage still writes on the usual 30s
// flush, and the interval dies with the port when the popup closes.
// (an open port also keeps this service worker awake, so setInterval is safe)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "popup") return;

  const tick = async () => {
    await checkAndReset(); // popup must never show stale usage across midnight
    const lims = await loadLimitsList();

    // copy so the pending session seconds never leak into storage
    const display = JSON.parse(JSON.stringify(lims || {}));
    if (!paused && startTime && currentTab) {
      const host = getTabDomain(currentTab);
      if (host) {
        if (!display[host] || typeof display[host] !== "object") {
          display[host] = { websiteName: host, timeLimit: 0, timeUsage: 0, redirect: "" };
        }
        display[host].timeUsage =
          (Number(display[host].timeUsage) || 0) + (Date.now() - startTime) / 1000;
      }
    }

    const cats = await loadCategories();
    const resolve = await makeHostResolver();
    try {
      port.postMessage({
        action: "list-of-screen-time",
        data: {
          sites: buildUsageMap(display),
          categories: buildCategoriesWithUsage(display, cats, resolve)
        }
      });
    } catch (e) {
      // port already closed
    }
  };

  tick();
  const interval = setInterval(tick, 1000);
  port.onDisconnect.addListener(() => clearInterval(interval));
});

// the service worker re-runs this top-level code every time it wakes up, so
// this catches missed resets and realigns the midnight alarm even when the
// browser stayed open (e.g. after a timezone change)
ensureDailyReset();

// alarm that triggers every 30 seconds to keep the popup awake
chrome.alarms.create("keep-awake", {
    delayInMinutes: 0.5,
    periodInMinutes: 0.5
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "keep-awake") {
    if (paused || !startTime || !currentTab) return;
    const elapsed = (Date.now() - startTime) / 1000;
    startTime = Date.now();
    await updateTime(getTabDomain(currentTab), elapsed);
  }
});