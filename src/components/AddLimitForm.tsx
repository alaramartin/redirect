import { useEffect, useState } from "react";
import { normalizeWebsiteInput, normalizeWebsiteTarget, hostOfKey } from "../shared/normalize";
import { BUILT_IN_CATEGORIES, MIN_LIMIT_SECONDS, MAX_LIMIT_SECONDS } from "../shared/types";
import type { CategoriesMap, EditTarget, LimitsMap, SiteCategoriesMap } from "../shared/types";
import type { BundledCategories } from "../shared/categories";
import { redirectTargetWarning } from "../shared/redirectWarning";
import TimeDurationSelect from "./TimeDurationSelect";

type LimitType = "site" | "category";

interface AddLimitFormProps {
  limits: LimitsMap;
  categories: CategoriesMap;
  siteCategories: SiteCategoriesMap;
  bundled: BundledCategories;
  // built-in categories plus any the user has created via "Add category"
  allCategories: string[];
  onSetLimit: (website: string, limitSeconds: number, redirect: string, blocked: boolean) => void;
  onSetCategoryLimit: (category: string, limitSeconds: number, redirect: string) => void;
  // set when an edit pencil was clicked: opens this form prefilled with that
  // entry's current settings (the type dropdown and identity field are
  // locked so an edit can't turn into a different entry)
  editTarget: EditTarget | null;
  onEditDone: () => void;
}

// the single "Add limit" button plus its form, merging the old separate
// website-limit and category-limit flows behind a type dropdown
export default function AddLimitForm({
  limits,
  categories,
  siteCategories,
  bundled,
  allCategories,
  onSetLimit,
  onSetCategoryLimit,
  editTarget,
  onEditDone,
}: AddLimitFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<LimitType>("site");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState<string>(BUILT_IN_CATEGORIES[0]);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [redirect, setRedirect] = useState("");
  const [blockCompletely, setBlockCompletely] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  // the redirect host the user has been warned about; submitting again with
  // the same target counts as confirmation
  const [warnedTarget, setWarnedTarget] = useState<string | null>(null);

  const editing = editTarget !== null;

  // an edit icon was clicked: open the form prefilled with the entry's
  // current settings (re-runs if the user picks a different entry to edit)
  useEffect(() => {
    if (!editTarget) return;
    if (editTarget.kind === "site") {
      const entry = limits[editTarget.host];
      setType("site");
      setWebsite(editTarget.host);
      setDurationSeconds(entry?.timeLimit ?? 0);
      setRedirect(entry?.redirect ?? "");
      setBlockCompletely(!!entry?.blocked);
    } else {
      const entry = categories[editTarget.category];
      setType("category");
      setCategory(editTarget.category);
      setDurationSeconds(entry?.timeLimit ?? 0);
      setRedirect(entry?.redirect ?? "");
    }
    setError("");
    setWarning("");
    setWarnedTarget(null); // warnings re-fire on save, same as creating
    setShowForm(true);
    // the edit icon lives further down the popup -- bring the form to it
    requestAnimationFrame(() =>
      document.getElementById("add-limit-form")?.scrollIntoView({ behavior: "smooth" })
    );
    // limits/categories deliberately not dependencies: refill only on a new
    // edit click, not on every background usage write while mid-edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget]);

  function closeForm() {
    clearInputs();
    setShowForm(false);
    onEditDone?.();
  }

  function clearInputs() {
    setType("site");
    setWebsite("");
    setCategory(BUILT_IN_CATEGORIES[0]);
    setDurationSeconds(0);
    setRedirect("");
    setBlockCompletely(false);
    setError("");
    setWarning("");
    setWarnedTarget(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); // stop the extension from reloading

    if (type === "site") {
      if (!website) {
        closeForm();
        return;
      }
      // clean up whatever was typed (full URL, www., mixed case) into the
      // same canonical key the background tracks time under -- a bare host,
      // or host + path for limiting just a section (youtube.com/shorts)
      const target = normalizeWebsiteTarget(website);
      if (!target) {
        setError("Please enter a valid website, e.g. instagram.com");
        return;
      }
      if (!blockCompletely) {
        if (durationSeconds < MIN_LIMIT_SECONDS) {
          setError("Time limit must be at least 1 second");
          return;
        }
        if (durationSeconds > MAX_LIMIT_SECONDS) {
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
        if (targetHost === hostOfKey(target)) {
          setError("The redirect can't point back to the same website");
          return;
        }
        // save-time rejection for the obvious case: an outright-blocked
        // target (time-limited targets stay allowed; the background
        // re-checks the target's budget at block time and skips the
        // redirect if it's out)
        if (limits[targetHost]?.blocked) {
          setError(`Can't redirect to ${targetHost} — you've blocked it completely`);
          return;
        }
        // soft warning for a target that's time-limited (directly or
        // through its category): allowed, but make the user confirm by
        // resubmitting
        if (warnedTarget !== targetHost) {
          const warnText = redirectTargetWarning(
            targetHost, limits, categories, siteCategories, bundled
          );
          if (warnText) {
            setError("");
            setWarnedTarget(targetHost);
            setWarning(`${warnText} Click "${editing ? "Save" : "Set Limit"}" again if you're sure.`);
            return;
          }
        }
      }

      onSetLimit(target, blockCompletely ? 0 : durationSeconds, redirect, blockCompletely);
      closeForm();
      return;
    }

    // type === "category"
    if (durationSeconds < MIN_LIMIT_SECONDS) {
      setError("Time limit must be at least 1 second");
      return;
    }
    if (durationSeconds > MAX_LIMIT_SECONDS) {
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
          setWarning(`${warnText} Click "${editing ? "Save" : "Set Limit"}" again if you're sure.`);
          return;
        }
      }
    }

    onSetCategoryLimit(category, durationSeconds, redirect.trim());
    closeForm();
  }

  return (
    <>
      <button
        id="add-limit-option"
        className="option-button"
        style={{ display: showForm ? "none" : "inline-flex" }}
        onClick={() => setShowForm(true)}
      >
        Add limit
      </button>
      <div id="add-limit-form" className="panel" style={{ display: showForm ? "block" : "none" }}>
        <form id="addlimit" onSubmit={handleSubmit}>
          <p>
            <label htmlFor="limittype">Limit type: </label>
            <select
              id="limittype"
              value={type}
              disabled={editing}
              onChange={(e) => {
                setType(e.target.value as LimitType);
                setError("");
                setWarning("");
                setWarnedTarget(null);
              }}
            >
              <option value="site">Individual website</option>
              <option value="category">Category</option>
            </select>
          </p>

          {type === "site" ? (
            <>
              <p>
                <label htmlFor="timelimurl">Website URL: </label>
                <input
                  type="text"
                  id="timelimurl"
                  value={website}
                  disabled={editing}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                    setWarnedTarget(null);
                    setWarning("");
                  }}
                />
              </p>
              {!editing && (
                <p className="form-hint">
                  Tip: add a path to limit just one section of a site, e.g. youtube.com/shorts
                  (covers /shorts and everything under it, leaving the rest of youtube.com alone).
                </p>
              )}
            </>
          ) : (
            <p>
              <label htmlFor="categoryselect">Category: </label>
              <select
                id="categoryselect"
                value={category}
                disabled={editing}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setWarnedTarget(null);
                  setWarning("");
                }}
              >
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </p>
          )}

          <p>Time limit:</p>
          <p>
            <TimeDurationSelect
              id="limit-duration"
              value={durationSeconds}
              onChange={setDurationSeconds}
              disabled={type === "site" && blockCompletely}
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

          {type === "site" && (
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
          )}

          {error && <p className="form-error">{error}</p>}
          {warning && <p className="form-warning">{warning}</p>}
          <input type="submit" value={editing ? "Save" : "Set Limit"} />
        </form>
        <button id="cancel-add-limit" className="form-cancel" onClick={closeForm}>
          Cancel
        </button>
      </div>
    </>
  );
}
