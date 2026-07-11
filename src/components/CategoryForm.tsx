import { useState } from "react";
import {
  BUILT_IN_CATEGORIES,
  MIN_LIMIT_SECONDS,
  MAX_LIMIT_SECONDS,
} from "../shared/types";
import type { CategoriesMap, LimitsMap, SiteCategoriesMap } from "../shared/types";
import type { BundledCategories } from "../shared/categories";
import { normalizeWebsiteInput } from "../shared/normalize";
import { redirectTargetWarning } from "../shared/redirectWarning";

interface CategoryFormProps {
  limits: LimitsMap;
  categories: CategoriesMap;
  siteCategories: SiteCategoriesMap;
  bundled: BundledCategories;
  onSetCategoryLimit: (category: string, limitSeconds: number, redirect: string) => void;
}

// "Add/Modify Category Limit" button plus its hidden form, mirroring LimitForm
export default function CategoryForm({
  limits,
  categories,
  siteCategories,
  bundled,
  onSetCategoryLimit,
}: CategoryFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>(BUILT_IN_CATEGORIES[0]);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [redirect, setRedirect] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [warnedTarget, setWarnedTarget] = useState<string | null>(null);

  function clearInputs() {
    setHours("");
    setMinutes("");
    setSeconds("");
    setRedirect("");
    setError("");
    setWarning("");
    setWarnedTarget(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const timeLim =
      (parseInt(hours) || 0) * 60 * 60 +
      (parseInt(minutes) || 0) * 60 +
      (parseInt(seconds) || 0);
    if (timeLim < MIN_LIMIT_SECONDS) {
      setError("Time limit must be at least 1 second");
      return;
    }
    if (timeLim > MAX_LIMIT_SECONDS) {
      setError("Time limit can't be more than 24 hours");
      return;
    }

    if (redirect.trim()) {
      const targetHost = normalizeWebsiteInput(redirect);
      if (!targetHost) {
        setError("The redirect isn't a valid website, e.g. khanacademy.org");
        return;
      }
      if (limits[targetHost]?.blocked) {
        setError(`Can't redirect to ${targetHost} — you've blocked it completely`);
        return;
      }
      if (warnedTarget !== targetHost) {
        const warnText = redirectTargetWarning(
          targetHost, limits, categories, siteCategories, bundled, category
        );
        if (warnText) {
          setError("");
          setWarnedTarget(targetHost);
          setWarning(`${warnText} Click "Set Limit" again if you're sure.`);
          return;
        }
      }
    }

    onSetCategoryLimit(category, timeLim, redirect.trim());
    clearInputs();
    setShowForm(false);
  }

  return (
    <>
      <button
        id="add-category-option"
        style={{ display: showForm ? "none" : "block" }}
        onClick={() => setShowForm(true)}
      >
        Add/Modify Category Limit
      </button>
      <div id="category-form" style={{ display: showForm ? "block" : "none" }}>
        <p>
          <em>Note: individual website limits override category limits.</em>
        </p>
        <form id="categorylimit" onSubmit={handleSubmit}>
          <p>
            <label htmlFor="categoryselect">Category: </label>
            <select
              id="categoryselect"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setWarnedTarget(null);
                setWarning("");
              }}
            >
              {BUILT_IN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </p>
          <p>Time Limit (shared across every site in the category):</p>
          <p>
            <label htmlFor="catlimh">Hours (0 if none): </label>
            <input
              type="number"
              id="catlimh"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="catlimmin">Minutes (0 if none): </label>
            <input
              type="number"
              id="catlimmin"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="catlimsec">Seconds (0 if none): </label>
            <input
              type="number"
              id="catlimsec"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="catredirect">
              (Optional) Specify a website to redirect to once limit is reached:{" "}
            </label>
            <input
              type="text"
              id="catredirect"
              value={redirect}
              onChange={(e) => {
                setRedirect(e.target.value);
                setWarnedTarget(null);
                setWarning("");
              }}
            />
          </p>
          {error && <p className="form-error">{error}</p>}
          {warning && <p className="form-warning">{warning}</p>}
          <input type="submit" value="Set Limit" />
        </form>
        <button id="cancel-set-category" onClick={() => { clearInputs(); setShowForm(false); }}>
          Cancel
        </button>
      </div>
    </>
  );
}
