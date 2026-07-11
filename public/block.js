// content script injected once the time limit is reached: replaces the page
// with a "website blocked" screen. All styles are inline so the site's own
// CSS (e.g. netflix's white-on-dark text) can't make the message invisible.
// Wrapped in an IIFE with a guard because the background may inject this
// more than once into the same tab (repeated tab events / re-navigation),
// and re-declaring top-level consts in the same isolated world throws.
(() => {
  if (window.__websiteBlocked) return;
  window.__websiteBlocked = true;

  document.body.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position: fixed",
    "inset: 0",
    "z-index: 2147483647",
    "display: flex",
    "justify-content: center",
    "align-items: center",
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
  document.body.appendChild(overlay);

  chrome.runtime.sendMessage({
    action: "blocked-website"
  });
})();
