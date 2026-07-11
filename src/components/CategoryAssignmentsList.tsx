import type { SiteCategoriesMap } from "../shared/types";
import type { BundledCategories } from "../shared/categories";
import { displayName } from "../shared/siteName";

interface CategoryAssignmentsListProps {
  siteCategories: SiteCategoriesMap;
  bundled: BundledCategories;
}

// shows the user's website -> category overrides (from "Modify categories")
export default function CategoryAssignmentsList({
  siteCategories,
  bundled,
}: CategoryAssignmentsListProps) {
  const overrides = Object.entries(siteCategories);
  if (overrides.length === 0) return null;

  return (
    <div id="categories" className="panel">
      <p className="panel-title">Website assignments</p>
      <ul id="list-of-assignments">
        {overrides.map(([host, category]) => (
          <li key={host} title={host}>
            {displayName(host, bundled)} → {category === null ? "none" : category}
          </li>
        ))}
      </ul>
    </div>
  );
}
