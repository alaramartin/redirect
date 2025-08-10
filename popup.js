// todo: make every time limit an object ... ?????
function WebsiteSettings(websiteName, timeLimit, timeUsage) {
    this.websiteName = websiteName;
    this.timeLimit = timeLimit; // in seconds
    this.timeUsage = timeUsage; // in seconds
}

function addItemToList(item, list) {
    var newItem = document.createElement("li");
    newItem.innerHTML = item;
    list.appendChild(newItem);
}

async function saveLimitsList(list) {
    await chrome.storage.local.set({ "limits" : list });
}

async function loadLimitsList() {
    const result = await chrome.storage.local.get("limits");
    if (result.limits == undefined) return {};
    console.log("loadlimlist", result.limits);
    return result.limits;
}

async function loadTimeList() {
    chrome.runtime.sendMessage({ action: "getScreenTime" }, (response) => {
    if (response && response.data) {
        console.log("Received screen time data ", JSON.stringify(response.data));
        displayTimeList(response.data);
    } else {
        console.log("No screen time data received.");
    }
    });
}

let lims = {};
async function init() {
    lims = await loadLimitsList();
    displayList();
    // let usage = await loadTimeList();
    // displayTimeList(usage);
    loadTimeList();
}
init();


// shows the list of limits on the popup alphabetically
// no duplicates, if there is a duplicate key it updates the value
async function displayList() {
    let limsList = document.getElementById("list-of-limits");
    limsList.innerHTML = "";
    lims = await loadLimitsList();
    for (const [key, value] of Object.entries(lims)) {
        addItemToList("Website: " + key + ", time limit: " +  value, limsList);
    }
}

function displayTimeList(screenTime) {
    let timeList = document.getElementById("list-of-screen-time");
    timeList.innerHTML = "";
    // convert dictionary to array of key-value
    let usageEntries = Object.entries(screenTime)
    // sort the usage list in descending order by value
    usageEntries.sort((a, b) => b[1] - a[1]);
    for (const [key, value] of usageEntries) {
        var hours = Math.floor(value/(60*60));
        var minutes = Math.floor((value - hours*60*60)/60);
        var seconds = (value - hours*60*60 - minutes*60).toFixed(2);
        addItemToList(`Website: ${key}, usage: ${hours} hours, ${minutes} minutes, ${seconds} seconds`, timeList);
    }
}

// get the time limit user input (convert to seconds) and save to list `lims`
// TODO: make the input require domain name format AND reject empty input ""
const inputElement = document.getElementById("userlimit");
inputElement.addEventListener("submit", async function(event) {
    event.preventDefault(); // stop the extension from reloading
    var website = document.getElementById("timelimurl").value;
    var timeLim = parseInt(document.getElementById("timelimh").value) * 60 * 60 + parseInt(document.getElementById("timelimmin").value) * 60 + parseInt(document.getElementById("timelimsec").value);
    lims[website] = timeLim;
    await saveLimitsList(lims);
    displayList();
    // reset the input fields after submitting
    document.getElementById("timelimurl").value = "";
    document.getElementById("timelimh").value = "";
    document.getElementById("timelimmin").value = "";
    document.getElementById("timelimsec").value = "";
    console.log("hi");
});

// deletes all saved limits
let resetButton = document.getElementById("reset");
resetButton.addEventListener("click", function() {
    document.getElementById("list-of-limits").innerHTML = "";
    lims = {};
    saveLimitsList(lims);
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "reset-usage") {
        loadTimeList();
    }

    if (message.action === "list-of-screen-time") {
        console.log("Popup received update:", JSON.stringify(message.data));
        displayTimeList(message.data);
    }
})