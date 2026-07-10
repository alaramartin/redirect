// content script to inject that modifies the html of the website once time limit is reached, displays "time's up"


document.body.style.backgroundColor = "white";

document.body.innerHTML = "website blocked";

chrome.runtime.sendMessage( {
    action: "blocked-website"
})