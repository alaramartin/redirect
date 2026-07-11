import { useState } from "react";
import { BUILT_IN_CATEGORIES } from "../shared/types";
import { normalizeWebsiteInput } from "../shared/normalize";

// special <select> values that aren't category ids
const USE_DEFAULT = "__default__"; // remove the override, fall back to the built-in list
const UNCATEGORIZED = "__none__"; // explicitly no category, even if the built-in list has one

interface AssignSiteFormProps {
  onAssignSite: (host: string, category: string | null | undefined) => void;
}

// "Assign Website to Category" button plus its hidden form. Lets the user
// override which category a site counts toward (or opt a site out entirely).
export default function AssignSiteForm({ onAssignSite }: AssignSiteFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [host, setHost] = useState("");
  const [choice, setChoice] = useState<string>(BUILT_IN_CATEGORIES[0]);
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (host) {
      const normalized = normalizeWebsiteInput(host);
      if (!normalized) {
        setError("Please enter a valid website, e.g. instagram.com");
        return;
      }
      // undefined = remove the override, null = explicitly uncategorized
      const category =
        choice === USE_DEFAULT ? undefined : choice === UNCATEGORIZED ? null : choice;
      onAssignSite(normalized, category);
    }
    setHost("");
    setError("");
    setShowForm(false);
  }

  return (
    <>
      <button
        id="assign-site-option"
        className="option-button"
        style={{ display: showForm ? "none" : "inline-flex" }}
        onClick={() => setShowForm(true)}
      >
        Modify categories
      </button>
      <div id="assign-form" className="panel" style={{ display: showForm ? "block" : "none" }}>
        <form id="assignsite" onSubmit={handleSubmit}>
          <p>
            <label htmlFor="assignhost">Website URL: </label>
            <input
              type="text"
              id="assignhost"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </p>
          <p>
            <label htmlFor="assigncategory">Category: </label>
            <select
              id="assigncategory"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              {BUILT_IN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={UNCATEGORIZED}>none (don't count toward any category)</option>
              <option value={USE_DEFAULT}>use default (remove my override)</option>
            </select>
          </p>
          {error && <p className="form-error">{error}</p>}
          <input type="submit" value="Assign" />
        </form>
        <button id="cancel-assign-site" className="form-cancel" onClick={() => setShowForm(false)}>
          Cancel
        </button>
      </div>
    </>
  );
}
