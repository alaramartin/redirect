import type {
    CategoriesMap,
    CategoryLimit,
    LimitsMap,
    SiteLimit,
    UsageMap,
} from "../shared/types";
import type { BundledCategories } from "../shared/categories";
import { formatTime } from "../shared/format";
import { displayName } from "../shared/siteName";
import ProgressBar from "./ProgressBar";

interface TimeLimitsSectionProps {
    limits: LimitsMap;
    categories: CategoriesMap;
    // live per-second usage from the background (same source the Usage
    // section ticks from), used instead of limits[host].timeUsage so a
    // limited site's progress bar ticks up in real time too
    usage: UsageMap;
    bundled: BundledCategories;
    onEditSite: (host: string) => void;
    onEditCategory: (category: string) => void;
    onDeleteSite: (host: string) => void;
    onDeleteCategory: (category: string) => void;
    onReset: () => void;
    focusLocked: boolean;
}

interface SiteRow {
    kind: "site";
    key: string;
    value: SiteLimit;
    liveUsage: number;
    blocked: boolean;
    pct: number;
}

interface CategoryRow {
    kind: "category";
    key: string;
    value: CategoryLimit;
    blocked: boolean;
    pct: number;
}

type Row = SiteRow | CategoryRow;

// the "Time Limits" panel: every individually-limited or blocked site, plus
// every category with a limit set, each shown as a progress bar
export default function TimeLimitsSection({
    limits,
    categories,
    usage,
    bundled,
    onEditSite,
    onEditCategory,
    onDeleteSite,
    onDeleteCategory,
    onReset,
    focusLocked,
}: TimeLimitsSectionProps) {
    const siteEntries = Object.entries(limits).filter(
        ([, value]) =>
            value &&
            typeof value === "object" &&
            (Number(value.timeLimit) > 0 || value.blocked),
    );
    const categoryEntries = Object.entries(categories).filter(
        ([, value]) => value && Number(value.timeLimit) > 0,
    );

    if (siteEntries.length === 0 && categoryEntries.length === 0) return null;

    const siteRows: Row[] = siteEntries.map(([host, value]) => {
        // usage[host] is the live per-second figure pushed by the
        // background; fall back to the last-saved value until that arrives
        const liveUsage = usage[host] ?? Number(value.timeUsage);
        return {
            kind: "site",
            key: host,
            value,
            liveUsage,
            blocked: !!value.blocked,
            pct:
                Number(value.timeLimit) > 0
                    ? liveUsage / Number(value.timeLimit)
                    : 0,
        };
    });
    const categoryRows: Row[] = categoryEntries.map(([id, value]) => ({
        kind: "category",
        key: id,
        value,
        blocked: false,
        pct:
            Number(value.timeLimit) > 0
                ? Number(value.timeUsage) / Number(value.timeLimit)
                : 0,
    }));

    // most-used-up first; outright-blocked entries have no meaningful
    // percentage (they carry no time limit), so they always sort last
    // regardless of usage, in whatever order they were already in
    const rows = [...siteRows, ...categoryRows].sort((a, b) => {
        if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
        return b.pct - a.pct;
    });

    return (
        <div id="limits" className="panel">
            <p className="panel-title">Time Limits</p>
            <ul id="list-of-limits">
                {rows.map((row) =>
                    row.kind === "site" ? (
                        <li key={`site-${row.key}`}>
                            <div className="limit-row-header">
                                <span
                                    className="limit-row-label"
                                    title={row.key}
                                >
                                    {displayName(row.key, bundled)}
                                </span>
                                {/* editing/deleting count as modifying limits: hidden during focus mode */}
                                {!focusLocked && (
                                    <span className="limit-row-actions">
                                        <button
                                            className="edit-limit"
                                            title={`Edit the limit for ${row.key}`}
                                            onClick={() => onEditSite(row.key)}
                                        >
                                            ✎
                                        </button>
                                        <button
                                            className="delete-limit"
                                            title={`Delete the limit for ${row.key}`}
                                            onClick={() =>
                                                onDeleteSite(row.key)
                                            }
                                        >
                                            ✕
                                        </button>
                                    </span>
                                )}
                            </div>
                            <ProgressBar
                                value={row.liveUsage}
                                max={Number(row.value.timeLimit)}
                                blocked={row.value.blocked}
                            />
                            <div className="limit-row-detail">
                                {row.value.blocked
                                    ? "blocked"
                                    : `${formatTime(row.liveUsage)} / ${formatTime(Number(row.value.timeLimit))}`}
                                {row.value.redirect
                                    ? ` · redirects to ${displayName(row.value.redirect, bundled)}`
                                    : " · no redirect"}
                            </div>
                        </li>
                    ) : (
                        <li key={`category-${row.key}`}>
                            <div className="limit-row-header">
                                <span className="limit-row-label">
                                    {row.key}
                                </span>
                                {!focusLocked && (
                                    <span className="limit-row-actions">
                                        <button
                                            className="edit-limit"
                                            title={`Edit the ${row.key} category limit`}
                                            onClick={() =>
                                                onEditCategory(row.key)
                                            }
                                        >
                                            ✎
                                        </button>
                                        <button
                                            className="delete-limit"
                                            title={`Delete the ${row.key} category limit`}
                                            onClick={() =>
                                                onDeleteCategory(row.key)
                                            }
                                        >
                                            ✕
                                        </button>
                                    </span>
                                )}
                            </div>
                            <ProgressBar
                                value={Number(row.value.timeUsage)}
                                max={Number(row.value.timeLimit)}
                            />
                            <div className="limit-row-detail">
                                {formatTime(Number(row.value.timeUsage))} /{" "}
                                {formatTime(Number(row.value.timeLimit))}
                                {row.value.redirect
                                    ? ` · redirects to ${displayName(row.value.redirect, bundled)}`
                                    : ""}
                            </div>
                        </li>
                    ),
                )}
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
