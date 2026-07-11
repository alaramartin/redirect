import { useState } from "react";
import { normalizeWebsiteInput } from "../shared/normalize";
import { MIN_LIMIT_SECONDS, MAX_LIMIT_SECONDS } from "../shared/types";
import type { CategoriesMap, LimitsMap, SiteCategoriesMap } from "../shared/types";
import type { BundledCategories } from "../shared/categories";
import { redirectTargetWarning } from "../shared/redirectWarning";

interface LimitFormProps {
  limits: LimitsMap;
  categories: CategoriesMap;
  siteCategories: SiteCategoriesMap;
  bundled: BundledCategories;
  onSetLimit: (website: string, limitSeconds: number, redirect: string, blocked: boolean) => void;
}

// the "Add/Modify Website Limit" button plus the (hidden by default) form,
// same DOM ids as the old popup.html so style.css applies unchanged
export default function LimitForm({
  limits,
  categories,
  siteCategories,
  bundled,
  onSetLimit,
}: LimitFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [website, setWebsite] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [redirect, setRedirect] = useState("");
  const [blockCompletely, setBlockCompletely] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  // the redirect host the user has been warned about; submitting again with
  // the same target counts as confirmation
  const [warnedTarget, setWarnedTarget] = useState<string | null>(null);

  function clearInputs() {
    setWebsite("");
    setHours("");
    setMinutes("");
    setSeconds("");
    setRedirect("");
    setBlockCompletely(false);
    setError("");
    setWarning("");
    setWarnedTarget(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); // stop the extension from reloading
    if (!website) {
      clearInputs();
      setShowForm(false);
      return;
    }

    // clean up whatever was typed (full URL, www., mixed case) into the
    // same canonical hostname the background tracks time under
    const host = normalizeWebsiteInput(website);
    if (!host) {
      setError("Please enter a valid website, e.g. instagram.com");
      return;
    }

    const timeLim =
      (parseInt(hours) || 0) * 60 * 60 +
      (parseInt(minutes) || 0) * 60 +
      (parseInt(seconds) || 0);
    if (!blockCompletely) {
      if (timeLim < MIN_LIMIT_SECONDS) {
        setError("Time limit must be at least 1 second");
        return;
      }
      if (timeLim > MAX_LIMIT_SECONDS) {
        setError("Time limit can't be more than 24 hours");
        return;
      }
    }

    if (redirect.trim()) {
      const targetHost = normalizeWebsiteInput(redirect);
      if (!targetHost) {
        setError("The redirect isn't a valid website, e.g. youtube.com");
        return;
      }
      if (targetHost === host) {
        setError("The redirect can't point back to the same website");
        return;
      }
      // save-time rejection for the obvious case: an outright-blocked target.
      // (time-limited targets stay allowed; the background re-checks the
      // target's budget at block time and skips the redirect if it's out)
      if (limits[targetHost]?.blocked) {
        setError(`Can't redirect to ${targetHost} — you've blocked it completely`);
        return;
      }
      // soft warning for a target that's time-limited (directly or through
      // its category): allowed, but make the user confirm by resubmitting
      if (warnedTarget !== targetHost) {
        const warnText = redirectTargetWarning(
          targetHost, limits, categories, siteCategories, bundled
        );
        if (warnText) {
          setError("");
          setWarnedTarget(targetHost);
          setWarning(`${warnText} Click "Set Limit" again if you're sure.`);
          return;
        }
      }
    }

    onSetLimit(host, blockCompletely ? 0 : timeLim, redirect, blockCompletely);
    clearInputs();
    setShowForm(false);
  }

  return (
    <>
      <button
        id="add-limit-option"
        style={{ display: showForm ? "none" : "block" }}
        onClick={() => setShowForm(true)}
      >
        Add/Modify Website Limit
      </button>
      <div id="limit-form" style={{ display: showForm ? "block" : "none" }}>
        <form id="userlimit" onSubmit={handleSubmit}>
          <p>
            <label htmlFor="timelimurl">Website URL: </label>
            <input
              type="text"
              id="timelimurl"
              value={website}
              onChange={(e) => {
                setWebsite(e.target.value);
                setWarnedTarget(null);
                setWarning("");
              }}
            />
          </p>
          <p>Time Limit:</p>
          <p>
            <label htmlFor="timelimh">Hours (0 if none): </label>
            <input
              type="number"
              id="timelimh"
              value={hours}
              disabled={blockCompletely}
              onChange={(e) => setHours(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="timelimmin">Minutes (0 if none): </label>
            <input
              type="number"
              id="timelimmin"
              value={minutes}
              disabled={blockCompletely}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="timelimsec">Seconds (0 if none): </label>
            <input
              type="number"
              id="timelimsec"
              value={seconds}
              disabled={blockCompletely}
              onChange={(e) => setSeconds(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="redirect">
              (Optional) Specify a website to redirect to once limit is reached:{" "}
            </label>
            <input
              type="text"
              id="redirect"
              value={redirect}
              onChange={(e) => {
                setRedirect(e.target.value);
                setWarnedTarget(null);
                setWarning("");
              }}
            />
          </p>
          <p>
            <label htmlFor="blockcompletely">
              Block this website completely?{" "}
              <input
                type="checkbox"
                id="blockcompletely"
                checked={blockCompletely}
                onChange={(e) => setBlockCompletely(e.target.checked)}
              />
            </label>
          </p>
          {error && <p className="form-error">{error}</p>}
          {warning && <p className="form-warning">{warning}</p>}
          <input type="submit" value="Set Limit" />
        </form>
        <button id="cancel-set-limit" onClick={() => { clearInputs(); setShowForm(false); }}>
          Cancel
        </button>
      </div>
    </>
  );
}
