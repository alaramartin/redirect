// content script injected once the time limit is reached: replaces the page
// with a "website blocked" screen. All styles are inline so the site's own
// CSS (e.g. netflix's white-on-dark text) can't make the message invisible.
// Wrapped in an IIFE with a guard because the background may inject this
// more than once into the same tab (repeated tab events / re-navigation),
// and re-declaring top-level consts in the same isolated world throws.
(() => {
  if (window.__websiteBlocked) return;
  window.__websiteBlocked = true;

  // abort the rest of the page load (scripts, media, images) -- when injected
  // at navigation commit this is what makes the block instant instead of
  // letting the site render first
  window.stop();

  // at commit time <body> may not exist yet, so clear it when it appears and
  // hang the overlay off <html>, which always exists
  const clearPage = () => {
    if (document.body) document.body.innerHTML = "";
  };
  clearPage();
  document.addEventListener("DOMContentLoaded", clearPage);

  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position: fixed",
    "inset: 0",
    "z-index: 2147483647",
    "display: flex",
    "flex-direction: column",
    "justify-content: center",
    "align-items: center",
    "gap: 20px",
    "background-color: #d5dee0",
  ].join(";");

  const message = document.createElement("div");
  message.textContent = "website blocked";
  message.style.cssText = [
    "font-family: serif",
    "font-size: 28px",
    "color: #2f2f2f",
    "background-color: #8faebc",
    "border: 3px solid #636d6e",
    "border-radius: 15px",
    "padding: 25px 50px",
  ].join(";");
  overlay.appendChild(message);

  // countdown row, hidden until the background asks for a redirect
  const countdownRow = document.createElement("div");
  countdownRow.style.cssText = [
    "display: none",
    "flex-direction: column",
    "align-items: center",
    "gap: 10px",
  ].join(";");

  const countdownText = document.createElement("div");
  countdownText.style.cssText = [
    "font-family: serif",
    "font-size: 20px",
    "color: #2f2f2f",
  ].join(";");

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel redirect";
  cancelButton.style.cssText = [
    "font-family: serif",
    "font-size: 17px",
    "color: #2f2f2f",
    "background-color: white",
    "border: 1px solid gray",
    "border-radius: 5px",
    "padding: 5px 15px",
    "cursor: pointer",
  ].join(";");

  countdownRow.appendChild(countdownText);
  countdownRow.appendChild(cancelButton);
  overlay.appendChild(countdownRow);

  // notice line for when the redirect is skipped (target itself blocked)
  const notice = document.createElement("div");
  notice.style.cssText = [
    "display: none",
    "font-family: serif",
    "font-style: italic",
    "font-size: 17px",
    "color: #2f2f2f",
    "max-width: 500px",
    "text-align: center",
  ].join(";");
  overlay.appendChild(notice);

  (document.documentElement || document).appendChild(overlay);

  // called by the background instead of the countdown when the configured
  // redirect target is itself blocked/out of time
  window.__showRedirectSkippedNotice = (text) => {
    notice.textContent = text;
    notice.style.display = "block";
  };

  let countdownInterval = null;

  cancelButton.addEventListener("click", () => {
    // remember the cancel so re-blocking this tab doesn't restart the countdown
    window.__redirectCancelled = true;
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    countdownRow.style.display = "none";
  });

  // called by the background (via a second executeScript) with the user's
  // redirect URL; counts down 5 seconds, then navigates. no-ops if the user
  // already cancelled or a countdown is running.
  window.__startRedirectCountdown = (url) => {
    if (window.__redirectCancelled || countdownInterval) return;
    let remaining = 5;
    countdownText.textContent = `redirecting in ${remaining}...`;
    countdownRow.style.display = "flex";
    countdownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        window.location.href = url;
        return;
      }
      countdownText.textContent = `redirecting in ${remaining}...`;
    }, 1000);
  };

  chrome.runtime.sendMessage({
    action: "blocked-website"
  });
})();
