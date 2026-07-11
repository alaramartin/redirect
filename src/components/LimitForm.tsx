import { useState } from "react";
import { normalizeWebsiteInput } from "../shared/normalize";

interface LimitFormProps {
  onSetLimit: (website: string, limitSeconds: number, redirect: string) => void;
}

// the "Add/Modify Website Limit" button plus the (hidden by default) form,
// same DOM ids as the old popup.html so style.css applies unchanged
export default function LimitForm({ onSetLimit }: LimitFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [website, setWebsite] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [redirect, setRedirect] = useState("");
  const [error, setError] = useState("");

  function clearInputs() {
    setWebsite("");
    setHours("");
    setMinutes("");
    setSeconds("");
    setError("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); // stop the extension from reloading
    const timeLim =
      (parseInt(hours) || 0) * 60 * 60 +
      (parseInt(minutes) || 0) * 60 +
      (parseInt(seconds) || 0);
    if (website) {
      // clean up whatever was typed (full URL, www., mixed case) into the
      // same canonical hostname the background tracks time under
      const host = normalizeWebsiteInput(website);
      if (!host) {
        setError("Please enter a valid website, e.g. instagram.com");
        return;
      }
      onSetLimit(host, timeLim, redirect);
    }
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
              onChange={(e) => setWebsite(e.target.value)}
            />
          </p>
          <p>Time Limit:</p>
          <p>
            <label htmlFor="timelimh">Hours (0 if none): </label>
            <input
              type="number"
              id="timelimh"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="timelimmin">Minutes (0 if none): </label>
            <input
              type="number"
              id="timelimmin"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="timelimsec">Seconds (0 if none): </label>
            <input
              type="number"
              id="timelimsec"
              value={seconds}
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
              onChange={(e) => setRedirect(e.target.value)}
            />
          </p>
          {error && <p className="form-error">{error}</p>}
          <input type="submit" value="Set Limit" />
        </form>
        <button id="cancel-set-limit" onClick={() => setShowForm(false)}>
          Cancel
        </button>
      </div>
    </>
  );
}
