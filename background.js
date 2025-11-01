chrome.runtime.onInstalled.addListener(() => {
  console.log("Service worker activated!");
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
    loadTimeList().then((limits) => {
      sendResponse({ data: buildUsageMap(limits) }).catch((err) => {
        console.error("getScreenTime message errored", err);
        sendResponse({data: {}});
      });
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

// save the list of alarms (same idea as popup.js savelist)
async function saveTimeList(list) {
  await chrome.storage.local.set({ "timespent" : list });
}

// load the list of screen time usage (same idea as popup.js loadlist)
async function loadTimeList() {
  const result = await chrome.storage.local.get("timespent");
  if (result.timespent == undefined) return {};
  console.log("loadtimelist", result.timespent);
  return result.timespent;
}

let screenTime = {};
let lims = {};
let timeoutId = null;
async function initialize() {
  // screenTime = await loadTimeList();
  lims = await loadLimitsList();
  console.log(screenTime, lims);
  timeoutId = null;

  // create alarm that triggers at midnight every day to update the popup
  chrome.alarms.create("reset-at-midnight", {
    delayInMinutes: getMinutesUntilMidnight(),
    periodInMinutes: 1440
  });

  // send initial
  chrome.runtime.sendMessage({
    action: "list-of-screen-time",
    data: buildUsageMap(lims)
  })
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
    lims = await loadLimitsList();
    // reset to 0
    for (const host of Object.keys(lims || {})) {
      if (lims[host] && typeof lims[host] === "object") {
        lims[host].timeUsage = 0;
      }
    }
    await saveTimeList(lims);
    // tell popup to reset the list of usage
    chrome.runtime.sendMessage({
      action: "list-of-screen-time",
      data: buildUsageMap(lims)
    })
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
});

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

  await saveTimeList(lims);
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
  screenTime = await loadTimeList();
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

  await saveTimeList(lims);
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


// // when the tab is closed (and there are no other tabs that replace it, i.e. window is closed and there is nothing to track)
// chrome.tabs.onRemoved.addListener(async function (tabId, changeInfo, tab) {
//   // if no new tab, then turn off the timer for the last one and update. do NOT start a new timer
//  // (if new tab, do nothing because that's handled by onactivated and onupdated)
    
// });