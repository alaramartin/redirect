import { useState } from "react";
import { MIN_LIMIT_SECONDS, MAX_LIMIT_SECONDS } from "../shared/types";
import { formatTime } from "../shared/format";

interface FocusModeProps {
  focusEnd: number; // ms epoch, 0/past = off
  now: number; // ticking Date.now() from App so the countdown is live
  onStart: (durationSeconds: number) => void;
}

// "Start Focus Mode" button plus its hidden duration form, mirroring the
// other option-button/form pairs. While focus mode is running it shows a
// live countdown instead -- there is intentionally no cancel/stop button.
export default function FocusMode({ focusEnd, now, onStart }: FocusModeProps) {
  const [showForm, setShowForm] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [error, setError] = useState("");

  const active = focusEnd > now;

  function clearInputs() {
    setHours("");
    setMinutes("");
    setSeconds("");
    setError("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const duration =
      (parseInt(hours) || 0) * 60 * 60 +
      (parseInt(minutes) || 0) * 60 +
      (parseInt(seconds) || 0);
    if (duration < MIN_LIMIT_SECONDS) {
      setError("Focus time must be at least 1 second");
      return;
    }
    if (duration > MAX_LIMIT_SECONDS) {
      setError("Focus time can't be more than 24 hours");
      return;
    }
    onStart(duration);
    clearInputs();
    setShowForm(false);
  }

  if (active) {
    return (
      <div id="focus">
        <p>Focus mode is on.</p>
        <p>
          Your limits are locked for the next{" "}
          {formatTime((focusEnd - now) / 1000)}.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        id="start-focus-option"
        style={{ display: showForm ? "none" : "block" }}
        onClick={() => setShowForm(true)}
      >
        Start Focus Mode
      </button>
      <div id="focus-form" style={{ display: showForm ? "block" : "none" }}>
        <p>
          <em>
            While focus mode is running, your limits are locked: you can't add,
            edit, or remove any website or category limit until the time is up
            — no matter what.
          </em>
        </p>
        <form id="focusmode" onSubmit={handleSubmit}>
          <p>Focus for:</p>
          <p>
            <label htmlFor="focush">Hours (0 if none): </label>
            <input
              type="number"
              id="focush"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="focusmin">Minutes (0 if none): </label>
            <input
              type="number"
              id="focusmin"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="focussec">Seconds (0 if none): </label>
            <input
              type="number"
              id="focussec"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
            />
          </p>
          {error && <p className="form-error">{error}</p>}
          <input type="submit" value="Start Focus Mode" />
        </form>
        <button id="cancel-focus" onClick={() => { clearInputs(); setShowForm(false); }}>
          Cancel
        </button>
      </div>
    </>
  );
}
