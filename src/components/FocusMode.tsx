import { useState } from "react";
import { MIN_LIMIT_SECONDS, MAX_LIMIT_SECONDS } from "../shared/types";
import { formatTime } from "../shared/format";
import TimeDurationSelect from "./TimeDurationSelect";

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
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");

  const active = focusEnd > now;

  function clearInputs() {
    setDuration(0);
    setError("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
      <div id="focus" className="panel">
        <p className="panel-title">Focus mode is on</p>
        <p>Your limits are locked for the next {formatTime((focusEnd - now) / 1000)}.</p>
      </div>
    );
  }

  return (
    <>
      <button
        id="start-focus-option"
        className="option-button"
        style={{ display: showForm ? "none" : "inline-flex" }}
        onClick={() => setShowForm(true)}
      >
        Start focus mode
      </button>
      <div id="focus-form" className="panel" style={{ display: showForm ? "block" : "none" }}>
        <p className="form-hint">
          While focus mode is running, your limits are locked: you can't add, edit, or remove
          any website or category limit until the time is up — no matter what.
        </p>
        <form id="focusmode" onSubmit={handleSubmit}>
          <p>Focus for:</p>
          <p>
            <TimeDurationSelect id="focus-duration" value={duration} onChange={setDuration} />
          </p>
          {error && <p className="form-error">{error}</p>}
          <input type="submit" value="Start focus mode" />
        </form>
        <button id="cancel-focus" className="form-cancel" onClick={() => { clearInputs(); setShowForm(false); }}>
          Cancel
        </button>
      </div>
    </>
  );
}
