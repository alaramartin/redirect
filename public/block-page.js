(() => {
  const params = new URLSearchParams(window.location.search);
  const host = params.get("host") || "";
  const redirect = params.get("redirect") || "";
  const noticeText = params.get("notice") || "";

  const siteEl = document.getElementById("blocked-site");
  const countdownRow = document.getElementById("countdown");
  const countdownText = document.getElementById("countdown-text");
  const cancelBtn = document.getElementById("cancel-redirect");
  const notice = document.getElementById("notice");

  if (siteEl && host) {
    siteEl.textContent = host;
  }

  if (noticeText && notice) {
    notice.textContent = noticeText;
    notice.style.display = "block";
  }

  if (!redirect || !countdownRow || !countdownText || !cancelBtn) return;

  let remaining = 5;
  let cancelled = false;
  countdownRow.style.display = "flex";
  countdownText.textContent = `redirecting in ${remaining}...`;

  cancelBtn.addEventListener("click", () => {
    cancelled = true;
    countdownRow.style.display = "none";
  });

  const timer = setInterval(() => {
    if (cancelled) {
      clearInterval(timer);
      return;
    }
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(timer);
      window.location.href = redirect;
      return;
    }
    countdownText.textContent = `redirecting in ${remaining}...`;
  }, 1000);
})();
