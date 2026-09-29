import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface ViolationCategory {
  name: string;
  points: number;
  violations: string[];
}

interface Props {
  categories: ViolationCategory[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Filter out violations in this set from the list */
  excludeViolations?: Set<string>;
  isDarkMode?: boolean;
  /** Extra class applied to the trigger button */
  className?: string;
}

export function ViolationTypePicker({
  categories,
  value,
  onChange,
  disabled = false,
  excludeViolations,
  isDarkMode = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Focus search when opening
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch("");
  }, [open]);

  const toggle = useCallback(() => {
    if (!disabled) setOpen((v) => !v);
  }, [disabled]);

  const select = useCallback(
    (v: string) => {
      onChange(v);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  // Filtered categories
  const q = search.trim().toLowerCase();
  const filtered = categories
    .map((cat) => ({
      ...cat,
      violations: cat.violations.filter(
        (v) =>
          (!excludeViolations || !excludeViolations.has(v)) &&
          (!q || v.toLowerCase().includes(q))
      ),
    }))
    .filter((cat) => cat.violations.length > 0);

  // Find the category points for the selected value (for the badge)
  const selectedPoints = (() => {
    for (const cat of categories) {
      if (cat.violations.includes(value)) return cat.points;
    }
    return null;
  })();

  // Dark mode class helpers
  const dk = isDarkMode;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm
          transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400
          ${dk
            ? "bg-slate-800/70 border-slate-700 text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            : "bg-white/70 border-slate-200 text-slate-800 hover:bg-white disabled:opacity-50"
          }
        `}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 text-left">
          {value ? (
            <>
              {selectedPoints !== null && (
                <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                  dk ? "bg-red-900/50 text-red-300" : "bg-red-50 text-red-600 border border-red-100"
                }`}>
                  -{selectedPoints}
                </span>
              )}
              <span className="truncate">{value}</span>
            </>
          ) : (
            <span className={dk ? "text-slate-400" : "text-slate-400"}>Chọn loại vi phạm...</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${dk ? "text-slate-400" : "text-slate-400"}`} />
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className={`
            absolute z-50 mt-1 w-full min-w-[260px] rounded-xl border shadow-xl overflow-hidden
            ${dk
              ? "bg-slate-900 border-slate-700"
              : "bg-white border-slate-200"
            }
          `}
          style={{ maxHeight: "320px", display: "flex", flexDirection: "column" }}
        >
          {/* Search */}
          <div className={`flex items-center gap-2 px-3 py-2 border-b ${dk ? "border-slate-700" : "border-slate-100"}`}>
            <Search className={`w-3.5 h-3.5 shrink-0 ${dk ? "text-slate-500" : "text-slate-400"}`} />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm lỗi vi phạm..."
              className={`flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 ${dk ? "text-slate-100" : "text-slate-800"}`}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className={`px-4 py-3 text-sm ${dk ? "text-slate-500" : "text-slate-400"}`}>Không tìm thấy.</p>
            ) : (
              filtered.map((cat) => (
                <div key={cat.name}>
                  {/* Category header */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 sticky top-0 ${dk ? "bg-slate-900" : "bg-slate-50"}`}>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${dk ? "text-slate-500" : "text-slate-400"}`}>
                      {cat.name}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      dk ? "bg-red-900/40 text-red-400" : "bg-red-50 text-red-500"
                    }`}>
                      -{cat.points}đ
                    </span>
                  </div>
                  {/* Violations */}
                  {cat.violations.map((v) => {
                    const selected = v === value;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => select(v)}
                        className={`
                          w-full text-left text-sm px-4 py-2 transition-colors flex items-center gap-2
                          ${selected
                            ? dk
                              ? "bg-indigo-900/50 text-indigo-300 font-medium"
                              : "bg-indigo-50 text-indigo-700 font-medium"
                            : dk
                              ? "text-slate-300 hover:bg-slate-800"
                              : "text-slate-700 hover:bg-slate-50"
                          }
                        `}
                      >
                        {selected && <span className="text-indigo-500 text-xs shrink-0">✓</span>}
                        <span className={selected ? "" : "pl-4"}>{v}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
