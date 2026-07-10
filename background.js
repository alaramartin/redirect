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
    // resume time tracking
    paused = false;
    startTime = Date.now(); // new session, restart the timer
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getScreenTime") {
    // check for a missed reset first so the popup never shows stale usage
    checkAndReset().then(() => loadLimitsList()).then((limits) => {
      sendResponse({ data: buildUsageMap(limits) });
    }).catch((err) => {
      console.error("getScreenTime error", err);
      sendResponse({ data: {} });
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


let screenTime = {};
let lims = {};
let timeoutId = null;
async function initialize() {
  lims = await loadLimitsList();
  console.log(screenTime, lims);
  timeoutId = null;

  await ensureDailyReset();

  // send initial
  chrome.runtime.sendMessage({
    action: "list-of-screen-time",
    data: buildUsageMap(lims)
  }).catch(() => {}); // popup may not be open
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
  await saveLimitsList(lims);
  await chrome.storage.local.set({ "lastResetDate": today });

  // fresh day: cancel any pending block timer and restart the current session
  // so a blocked site becomes usable immediately
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  timeSpent = 0;
  if (startTime != null) startTime = Date.now();

  // tell popup to reset the list of usage
  chrome.runtime.sendMessage({
    action: "list-of-screen-time",
    data: buildUsageMap(lims)
  }).catch(() => {}); // popup may not be open
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

function getTabDomain(tab) {
  // if tab isn't null, return domain name of tab
  if (tab && tab.url) {
    try {
      let urlObj = new URL(tab.url);
      console.log("nothing wrong with url", tab.url);
      return urlObj.hostname;
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
chrome.runtime.sendMessage({
  action: "list-of-screen-time",
  data: buildUsageMap()
}).catch(() => {}); // popup may not be open

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

  // increment the usage
  const prev = Number(lims[website].timeUsage) || 0;
  lims[website].timeUsage = prev + Number(time || 0);

  await saveLimitsList(lims);
  console.log("upadting time spent for", website);

  // display the list
  chrome.runtime.sendMessage({
    action: "list-of-screen-time",
    data: buildUsageMap(lims)
  });
}

// saves time spent on the website when tab switched
chrome.tabs.onActivated.addListener(async function(tabId, changeInfo, tab) {
  console.log("onactivated");

  handleWebsiteChange();
});

// if the tab was updated and the website was changed, just act like the tab was changed
chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
  console.log("onupdated");

  // check if tab has finished loading/reloading
  if (changeInfo.status === "complete") {
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
  
  // begin timing new url
  timeSpent = 0;
  startTime = Date.now();

  // set a timeout timer -> call timeout() when the screen time limit runs out IF THERE IS A TIME LIMIT SET
  if (lims[currentTabHostname]) {
    if (!lims[currentTabHostname].timeUsage) lims[currentTabHostname].timeUsage = 0;
    const limit = Number(lims[currentTabHostname].timeLimit || 0);
    const usage = Number(lims[currentTabHostname].timeUsage || 0);
    
    // time left for that website, in milliseconds
    let timeLeft = 1000 * (limit - usage);
    console.log("time difference: ", timeLeft);
    // if limit has already been surpassed, immediately block
    if (timeLeft <= 0 && limit > 0) {
      // default to 10 seconds for testing purposes
      // timeLeft = 10 * 1000;
      console.log("time limit already surpassed");
      await blockSite(currentTab);
      startTime = null;
    }
    // else, if there is still time left, set timout timer
    else if (limit > 0) {
      // function reference to timeout(), to call after a delay of `timeLeft`
      timeoutId = setTimeout(() => timeout(currentTab), timeLeft);
      console.log("set timeout timer ", timeoutId, " ", currentTabHostname);
    }
    
  }
}

// block the tab once time is up
async function timeout(tab) {
  await blockSite(tab);
  console.log("timed out ", getTabDomain(tab), "!");
  // stop tracking time on the website
  await stopTimer();
}

// if timeout() called, stop recording time, update screenTime with screenTime = timeLimit (which should == timeSpent)
async function stopTimer() {
  console.log("received stop-timer");
  let currentTabHostname = getTabDomain(currentTab);
  if (!currentTabHostname) return;

  timeSpent += (Date.now() - startTime) / 1000;
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

  const limit = Number(lims[currentTabHostname].timeLimit) || 0;
  if (limit > 0 && lims[currentTabHostname].timeUsage > limit) {
    lims[currentTabHostname].timeUsage = limit;
  }

  await saveLimitsList(lims);
  clearTimeout(timeoutId);
  timeoutId = null;

  // notify popup
  chrome.runtime.sendMessage({
    action: "list-of-screen-time",
    data: buildUsageMap(lims)
  });
}

// inject content script to block access to the site
async function blockSite(tab) {
  console.log("website blocked on ", getTabDomain(tab));
  // inject content script
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["block.js"]
  });
  // inject content script's css file
  await chrome.scripting.insertCSS({
      target: {
        tabId: tab.id,
      },
      files: ["block.css"]
    });
}

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