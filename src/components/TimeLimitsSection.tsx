import type { CategoriesMap, LimitsMap } from "../shared/types";
import type { BundledCategories } from "../shared/categories";
import { formatTime } from "../shared/format";
import { displayName } from "../shared/siteName";
import ProgressBar from "./ProgressBar";

interface TimeLimitsSectionProps {
  limits: LimitsMap;
  categories: CategoriesMap;
  bundled: BundledCategories;
  onEditSite: (host: string) => void;
  onEditCategory: (category: string) => void;
  onDeleteSite: (host: string) => void;
  onDeleteCategory: (category: string) => void;
  onReset: () => void;
  focusLocked: boolean;
}

// the "Time Limits" panel: every individually-limited or blocked site, plus
// every category with a limit set, each shown as a progress bar
export default function TimeLimitsSection({
  limits,
  categories,
  bundled,
  onEditSite,
  onEditCategory,
  onDeleteSite,
  onDeleteCategory,
  onReset,
  focusLocked,
}: TimeLimitsSectionProps) {
  const siteEntries = Object.entries(limits).filter(
    ([, value]) => value && typeof value === "object" && (Number(value.timeLimit) > 0 || value.blocked)
  );
  const categoryEntries = Object.entries(categories).filter(
    ([, value]) => value && Number(value.timeLimit) > 0
  );

  if (siteEntries.length === 0 && categoryEntries.length === 0) return null;

  return (
    <div id="limits" className="panel">
      <p className="panel-title">Time limits</p>
      <ul id="list-of-limits">
        {siteEntries.map(([host, value]) => (
          <li key={host}>
            <div className="limit-row-header">
              <span className="limit-row-label" title={host}>
                {displayName(host, bundled)}
              </span>
              {/* editing/deleting count as modifying limits: hidden during focus mode */}
              {!focusLocked && (
                <span className="limit-row-actions">
                  <button
                    className="edit-limit"
                    title={`Edit the limit for ${host}`}
                    onClick={() => onEditSite(host)}
                  >
                    ✎
                  </button>
                  <button
                    className="delete-limit"
                    title={`Delete the limit for ${host}`}
                    onClick={() => onDeleteSite(host)}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            <ProgressBar
              value={Number(value.timeUsage)}
              max={Number(value.timeLimit)}
              blocked={value.blocked}
            />
            <div className="limit-row-detail">
              {value.blocked
                ? "completely blocked"
                : `${formatTime(Number(value.timeUsage))} / ${formatTime(Number(value.timeLimit))}`}
              {value.redirect ? ` · redirects to ${displayName(value.redirect, bundled)}` : ""}
            </div>
          </li>
        ))}
        {categoryEntries.map(([id, value]) => (
          <li key={id}>
            <div className="limit-row-header">
              <span className="limit-row-label">{id}</span>
              {!focusLocked && (
                <span className="limit-row-actions">
                  <button
                    className="edit-limit"
                    title={`Edit the ${id} category limit`}
                    onClick={() => onEditCategory(id)}
                  >
                    ✎
                  </button>
                  <button
                    className="delete-limit"
                    title={`Delete the ${id} category limit`}
                    onClick={() => onDeleteCategory(id)}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            <ProgressBar value={Number(value.timeUsage)} max={Number(value.timeLimit)} />
            <div className="limit-row-detail">
              {formatTime(Number(value.timeUsage))} / {formatTime(Number(value.timeLimit))}
              {value.redirect ? ` · redirects to ${displayName(value.redirect, bundled)}` : ""}
            </div>
          </li>
        ))}
      </ul>
      {/* removing limits counts as modifying them: no reset during focus mode */}
      {!focusLocked && (
        <button id="reset" onClick={onReset}>
          Reset limits
        </button>
      )}
    </div>
  );
}
