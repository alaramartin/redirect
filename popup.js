// todo: make every time limit an object ... ?????
function WebsiteSettings(websiteName, timeLimit, timeUsage, redirect) {
    this.websiteName = websiteName;
    this.timeLimit = timeLimit; // in seconds
    this.timeUsage = timeUsage; // in seconds
    this.redirect = redirect ? redirect : ""; // website URl to redirect to, if specified
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

function formatTime(seconds) {
    seconds = Number(seconds) || 0;
    var hours = Math.floor(seconds/(60*60));
    var minutes = Math.floor((seconds - hours*60*60)/60);
    var seconds = (seconds - hours*60*60 - minutes*60).toFixed(2);
    var stringToPrint = "";
    stringToPrint += hours != 0 ? `${hours} hours, ` : "";
    stringToPrint += minutes != 0 ? `${minutes} minutes, ` : "";
    stringToPrint += seconds != 0 ? `${seconds} seconds` : "";
    return stringToPrint;
}

let lims = {};
async function init() {
    lims = await loadLimitsList();
    displayList();
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
        const limitSeconds = (typeof value === "object" && value.timeLimit !== undefined) ? value.timeLimit : value;
        var stringToPrint = formatTime(limitSeconds);
        // show redirect if the user specified one
        stringToPrint += (typeof value === "object" && value.redirect) ? `, redirect: ${value.redirect}` : "";
        // don't add undefined to the list
        if (key) {
            addItemToList(`Website: ${key}, time limit: ${stringToPrint}`, limsList);
        }
        
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
        const limitSeconds = (typeof value === "object" && value.timeLimit !== undefined) ? value.timeLimit : value;
        var stringToPrint = formatTime(limitSeconds);
        // don't add undefined to the list
        if (key) {
            addItemToList(`Website: ${key}, usage: ${stringToPrint}`, timeList);
        }
    }
}

// listen to when the add limit button is pressed and show the website limit adding form
let addLimitButton = document.getElementById("add-limit-option");
addLimitButton.addEventListener("click", () => {
    addLimitButton.style.display = "none";
    document.getElementById("limit-form").style.display = "block";
});

// listen for cancel button, if pressed then get rid of limit-form and show the button again
let cancelButton = document.getElementById("cancel-set-limit");
cancelButton.addEventListener("click", () => {
    addLimitButton.style.display = "block";
    document.getElementById("limit-form").style.display = "none";
})

// get the time limit user input (convert to seconds) and save to list `lims`
// TODO: make the input require domain name format
const inputElement = document.getElementById("userlimit");
inputElement.addEventListener("submit", async function(event) {
    event.preventDefault(); // stop the extension from reloading
    var website = document.getElementById("timelimurl").value;
    var timeLim = parseInt(document.getElementById("timelimh").value) * 60 * 60 + parseInt(document.getElementById("timelimmin").value) * 60 + parseInt(document.getElementById("timelimsec").value);
    var redirect = document.getElementById("redirect").value;
    // check that it wasn't empty input
    if (website) {
        await loadLimitsList();
        const existingWebsiteInfo = lims[website];
        const existingUsage = (existingWebsiteInfo && existingWebsiteInfo.timeUsage) ? existingWebsiteInfo.timeUsage : 0;
         // saves as the currently saved usage if there is any
        lims[website] = new WebsiteSettings(website, timeLim, existingUsage, redirect);
        await saveLimitsList(lims);
        displayList();
    }
    // reset the input fields after submitting
    document.getElementById("timelimurl").value = "";
    document.getElementById("timelimh").value = "";
    document.getElementById("timelimmin").value = "";
    document.getElementById("timelimsec").value = "";
    console.log("hi");

    // hide the limit form and show the button again
    addLimitButton.style.display = "block";
    document.getElementById("limit-form").style.display = "none";
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
});