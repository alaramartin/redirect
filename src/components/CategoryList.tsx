import type { CategoriesMap, SiteCategoriesMap } from "../shared/types";
import { formatTime } from "../shared/format";

interface CategoryListProps {
  categories: CategoriesMap;
  siteCategories: SiteCategoriesMap;
}

// the "Category Limits" panel: each category budget with its combined usage,
// plus any per-site overrides the user has made
export default function CategoryList({ categories, siteCategories }: CategoryListProps) {
  const entries = Object.entries(categories).filter(
    ([, value]) => value && Number(value.timeLimit) > 0
  );
  const overrides = Object.entries(siteCategories);

  if (entries.length === 0 && overrides.length === 0) return null;

  return (
    <div id="categories">
      <p>Category Limits</p>
      <ul id="list-of-categories">
        {entries.map(([id, value]) => (
          <li key={id}>
            Category: {id}, time limit: {formatTime(Number(value.timeLimit))}, used:{" "}
            {formatTime(Number(value.timeUsage))}
            {value.redirect ? `, redirect: ${value.redirect}` : ""}
          </li>
        ))}
      </ul>
      {overrides.length > 0 && (
        <>
          <p>Website assignments</p>
          <ul id="list-of-assignments">
            {overrides.map(([host, category]) => (
              <li key={host}>
                {host} → {category === null ? "none" : category}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
