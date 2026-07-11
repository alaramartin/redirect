import { splitTime } from "../shared/format";

interface TimeDurationSelectProps {
  id: string;
  value: number; // total seconds
  onChange: (totalSeconds: number) => void;
  disabled?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23
const MINUTES_SECONDS = Array.from({ length: 60 }, (_, i) => i); // 0-59

// horizontal row of hour/minute/second dropdowns, controlled on a single
// total-seconds value (a <select> always has a concrete option, so there's
// no blank/partial state to track like the old free-text h/m/s inputs had)
export default function TimeDurationSelect({
  id,
  value,
  onChange,
  disabled,
}: TimeDurationSelectProps) {
  const { h, m, s } = splitTime(value);
  // a pre-existing limit saved at exactly 24h decomposes to h=24, which the
  // 0-23 dropdown can't normally represent -- extend the option list rather
  // than silently truncating the displayed value
  const hourOptions = h > 23 ? [...HOURS, h] : HOURS;

  function set(next: { h: number; m: number; s: number }) {
    onChange(next.h * 3600 + next.m * 60 + next.s);
  }

  return (
    <span className="duration-select" id={id}>
      <span className="duration-field">
        <select
          aria-label="hours"
          value={h}
          disabled={disabled}
          onChange={(e) => set({ h: Number(e.target.value), m, s })}
        >
          {hourOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="duration-unit">hours</span>
      </span>
      <span className="duration-field">
        <select
          aria-label="minutes"
          value={m}
          disabled={disabled}
          onChange={(e) => set({ h, m: Number(e.target.value), s })}
        >
          {MINUTES_SECONDS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="duration-unit">minutes</span>
      </span>
      <span className="duration-field">
        <select
          aria-label="seconds"
          value={s}
          disabled={disabled}
          onChange={(e) => set({ h, m, s: Number(e.target.value) })}
        >
          {MINUTES_SECONDS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="duration-unit">seconds</span>
      </span>
    </span>
  );
}
