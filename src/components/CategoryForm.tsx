import { useState } from "react";
import { BUILT_IN_CATEGORIES } from "../shared/types";

interface CategoryFormProps {
  onSetCategoryLimit: (category: string, limitSeconds: number) => void;
}

// "Add/Modify Category Limit" button plus its hidden form, mirroring LimitForm
export default function CategoryForm({ onSetCategoryLimit }: CategoryFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>(BUILT_IN_CATEGORIES[0]);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const timeLim =
      (parseInt(hours) || 0) * 60 * 60 +
      (parseInt(minutes) || 0) * 60 +
      (parseInt(seconds) || 0);
    onSetCategoryLimit(category, timeLim);
    setHours("");
    setMinutes("");
    setSeconds("");
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
        <form id="categorylimit" onSubmit={handleSubmit}>
          <p>
            <label htmlFor="categoryselect">Category: </label>
            <select
              id="categoryselect"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
          <input type="submit" value="Set Limit" />
        </form>
        <button id="cancel-set-category" onClick={() => setShowForm(false)}>
          Cancel
        </button>
      </div>
    </>
  );
}
