import { useState } from "react";
import { normalizeWebsiteInput } from "../shared/normalize";
import type { SiteCategoriesMap } from "../shared/types";
import type { BundledCategories } from "../shared/categories";
import { resolveHostCategory } from "../shared/categories";
import { displayName } from "../shared/siteName";

interface CategoryManagerProps {
  // built-in categories plus any the user has created via "Add category"
  allCategories: string[];
  customCategories: string[];
  siteCategories: SiteCategoriesMap;
  bundled: BundledCategories;
  // category === null removes a site from a category (explicitly uncategorized)
  onAssignSite: (host: string, category: string | null) => void;
  onAddCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
}

// turns a user-typed category name into a stable id: lowercase, anything
// that isn't a letter/digit collapsed to a single hyphen -- matches the
// plain-word style of the six bundled categories ("entertainment", "social")
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "Modify categories" button plus the category management view: every
// category listed with its member websites (add via a text field + "+",
// remove via a ✕ next to each site), plus "Add category" / a per-category
// "Delete category" for anything the user created (the six bundled defaults
// can't be deleted).
export default function CategoryManager({
  allCategories,
  customCategories,
  siteCategories,
  bundled,
  onAssignSite,
  onAddCategory,
  onDeleteCategory,
}: CategoryManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryError, setAddCategoryError] = useState("");

  // every hostname the app knows about (bundled defaults + user overrides),
  // so membership can be derived the same way the background resolves it
  const candidateHosts = Array.from(
    new Set([...Object.keys(bundled.domains), ...Object.keys(siteCategories)])
  );

  function membersOf(category: string): string[] {
    return candidateHosts
      .filter((host) => resolveHostCategory(host, siteCategories, bundled) === category)
      .sort();
  }

  function handleAddCategory(event: React.FormEvent) {
    event.preventDefault();
    const id = slugify(newCategoryName);
    if (!id) {
      setAddCategoryError("Please enter a category name");
      return;
    }
    if (allCategories.includes(id)) {
      setAddCategoryError("That category already exists");
      return;
    }
    onAddCategory(id);
    setNewCategoryName("");
    setAddCategoryError("");
  }

  return (
    <>
      <button
        id="manage-categories-option"
        className="option-button"
        style={{ display: showForm ? "none" : "inline-flex" }}
        onClick={() => setShowForm(true)}
      >
        Modify categories
      </button>
      <div
        id="category-manager"
        className="panel"
        style={{ display: showForm ? "block" : "none" }}
      >
        <p className="panel-title">Categories</p>
        <ul id="list-of-categories">
          {allCategories.map((category) => (
            <CategoryRow
              key={category}
              category={category}
              members={membersOf(category)}
              isCustom={customCategories.includes(category)}
              bundled={bundled}
              onAdd={(host) => onAssignSite(host, category)}
              onRemove={(host) => onAssignSite(host, null)}
              onDelete={() => onDeleteCategory(category)}
            />
          ))}
        </ul>

        <form id="addcategory" className="add-category-form" onSubmit={handleAddCategory}>
          <label htmlFor="newcategoryname">New category: </label>
          <input
            type="text"
            id="newcategoryname"
            value={newCategoryName}
            onChange={(e) => {
              setNewCategoryName(e.target.value);
              setAddCategoryError("");
            }}
            placeholder="e.g. Work"
          />
          <button type="submit">+ Add category</button>
        </form>
        {addCategoryError && <p className="form-error">{addCategoryError}</p>}

        <button
          id="cancel-manage-categories"
          className="form-cancel"
          onClick={() => setShowForm(false)}
        >
          Close
        </button>
      </div>
    </>
  );
}

interface CategoryRowProps {
  category: string;
  members: string[];
  isCustom: boolean;
  bundled: BundledCategories;
  onAdd: (host: string) => void;
  onRemove: (host: string) => void;
  onDelete: () => void;
}

// one category: collapsed by default (there can be a lot of these once
// every bundled category is listed, and each one used to force a long
// scroll just to see the next category's name) -- its member websites (each
// with a ✕ to remove) and the add-website field only render once expanded.
function CategoryRow({
  category,
  members,
  isCustom,
  bundled,
  onAdd,
  onRemove,
  onDelete,
}: CategoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [host, setHost] = useState("");
  const [error, setError] = useState("");

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!host.trim()) return;
    const normalized = normalizeWebsiteInput(host);
    if (!normalized) {
      setError("Please enter a valid website, e.g. instagram.com");
      return;
    }
    onAdd(normalized);
    setHost("");
    setError("");
  }

  return (
    <li className="category-row">
      <div className="limit-row-header">
        <button
          type="button"
          className="category-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="category-toggle-icon">{expanded ? "▾" : "▸"}</span>
          <span className="limit-row-label">{category}</span>
          <span className="category-count">({members.length})</span>
        </button>
        {isCustom && (
          <span className="limit-row-actions">
            <button
              className="delete-limit"
              title={`Delete the ${category} category`}
              onClick={onDelete}
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {expanded && (
        <div className="category-body">
          {members.length > 0 ? (
            <ul className="category-members">
              {members.map((memberHost) => (
                <li key={memberHost}>
                  <span title={memberHost}>{displayName(memberHost, bundled)}</span>
                  <button
                    className="delete-limit"
                    title={`Remove ${memberHost} from ${category}`}
                    onClick={() => onRemove(memberHost)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="form-hint">No websites in this category yet.</p>
          )}

          <form className="add-site-form" onSubmit={handleAdd}>
            <input
              type="text"
              value={host}
              onChange={(e) => {
                setHost(e.target.value);
                setError("");
              }}
              placeholder="Add a website..."
            />
            <button type="submit" title={`Add a website to ${category}`}>
              +
            </button>
          </form>
          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </li>
  );
}
