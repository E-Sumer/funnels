import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Globe, Lock } from "lucide-react";
import { TinyTooltip } from "../components/ui/tiny-tooltip";

export type FunnelVisibility = "private" | "public";

export type FunnelListRow = {
  id: string;
  name: string;
  visibility: FunnelVisibility;
  createdBy: string;
  createdDate: string;
  lastUpdated: string;
};

const MOCK_FUNNELS: FunnelListRow[] = [
  { id: "1", name: "Q4 Checkout Conversion", visibility: "private", createdBy: "Sarah Jenkins", createdDate: "Apr 12, 2025", lastUpdated: "2 hours ago" },
  { id: "2", name: "SaaS Onboarding Flow", visibility: "public", createdBy: "Alex Morgan", createdDate: "Mar 28, 2025", lastUpdated: "Yesterday" },
  { id: "3", name: "Mobile Subscription Upsell", visibility: "private", createdBy: "Michael Chen", createdDate: "Feb 15, 2025", lastUpdated: "3 days ago" },
  { id: "4", name: "Email Campaign Flow Tracking", visibility: "public", createdBy: "Elena Rodriguez", createdDate: "Jan 22, 2025", lastUpdated: "Oct 15, 2024" },
  { id: "5", name: "Netmera test app funnel stats", visibility: "private", createdBy: "System", createdDate: "Jan 1, 2023", lastUpdated: "Dec 31, 2023" },
];

/** Display name of the signed-in user; used to allow visibility edits only for funnels they created. */
function getCurrentUserName(): string {
  if (typeof window === "undefined") return "Sarah Jenkins";
  return localStorage.getItem("funnelsCurrentUserName") || "Sarah Jenkins";
}

type MenuItem = "view" | "edit" | "duplicate" | "export" | "delete";

const TABLE_COLS = "1fr 160px 160px 160px 160px 90px" as const;

export function FunnelsListPage() {
  const navigate = useNavigate();
  const [search, setSearch]     = useState("");
  const [funnels, setFunnels]   = useState(MOCK_FUNNELS);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const currentUserName = useMemo(() => getCurrentUserName(), []);

  const filtered = funnels.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAction = (action: MenuItem, id: string) => {
    setOpenMenu(null);
    if (action === "delete") {
      setFunnels((prev) => prev.filter((f) => f.id !== id));
    } else if (action === "duplicate") {
      const src = funnels.find((f) => f.id === id);
      if (src) {
        setFunnels((prev) => [
          ...prev,
          { ...src, id: String(Date.now()), name: `${src.name} (Copy)`, lastUpdated: "Just now" },
        ]);
      }
    } else if (action === "view" || action === "edit") {
      navigate(`/funnel/${id}`);
    }
  };

  const toggleVisibility = (id: string) => {
    setFunnels((prev) =>
      prev.map((f) => (f.id === id ? { ...f, visibility: f.visibility === "public" ? "private" : "public" } : f)),
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Utility bar */}
      <div
        className="flex items-center justify-end shrink-0 border-b border-[#ededed]"
        style={{ height: 26, background: "#FAFAFA" }}
      >
        <button className="text-[11px] font-medium px-4 h-full border-r border-[#ededed] hover:bg-[#f0f0f0] transition-colors" style={{ color: "#8A8A8A" }}>
          Add favorite
        </button>
        <button className="text-[11px] font-medium px-5 h-full hover:bg-[#f0f0f0] transition-colors" style={{ color: "#8A8A8A" }}>
          Report a bug
        </button>
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 shrink-0 bg-white border-b border-[#f5f5f5]"
        style={{ height: 66 }}
      >
        <div className="flex items-center gap-4">
          <div className="w-[3px] h-8 bg-[#006bff] rounded-full" />
          <div>
            <h2 className="text-[18px] font-semibold text-[#006bff] leading-6">Funnels</h2>
            <p className="text-[11px] font-medium leading-[16.5px]" style={{ color: "#8A8A8A" }}>
              Analyze user conversion paths
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 h-10 px-5 bg-white border-2 border-[#ededed] rounded-lg text-[14px] text-[#757575] font-medium hover:bg-[#f5f5f5] transition-colors">
            Import Funnel
          </button>
          <button
            onClick={() => navigate("/funnel/new")}
            className="flex items-center gap-2 h-10 px-5 bg-[#10b981] rounded-lg text-[14px] text-white font-medium hover:bg-[#0ea571] transition-colors"
          >
            + Create Funnel
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#fafafa]">
        {/* Search + filter row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 h-9 bg-white border border-[#ededed] rounded-lg px-3 flex-1 max-w-xs">
            <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 15 15" style={{ color: "#C2C2C2" }}>
              <path d="M10.5 9.11a5.63 5.63 0 1 0-1.39 1.39l4.04 4.04 1.39-1.39L10.5 9.1zm-4.88.83a3.75 3.75 0 1 1 0-7.5 3.75 3.75 0 0 1 0 7.5z" fill="currentColor" />
            </svg>
            <input
              type="text"
              placeholder="Search by funnel name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-[12px] text-[#212121] bg-transparent outline-none flex-1 placeholder-[#C2C2C2]"
            />
          </div>
          <button className="flex items-center gap-2 h-9 px-3 bg-white border border-[#ededed] rounded-lg text-[12px] text-[#212121] font-medium hover:bg-[#f5f5f5] transition-colors">
            <svg className="size-3.5" fill="none" viewBox="0 0 18 15">
              <path d="M13.5 3a.75.75 0 0 1 0-1.5h3a.75.75 0 0 1 0 1.5h-3zm-12.75 0H10.5v1.5H0a.75.75 0 0 1 0-1.5zm5.25 9h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1 0-1.5zm-4.5-1.5v1.5H0a.75.75 0 0 1 0-1.5h3.5zM0 7.5h17.25a.75.75 0 0 1 0 1.5H0a.75.75 0 0 1 0-1.5z" fill="#212121" />
            </svg>
            Filters
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-[#ededed] overflow-hidden">
          {/* Header */}
          <div
            className="grid border-b-2 border-[#ededed]"
            style={{ gridTemplateColumns: TABLE_COLS }}
          >
            {["Funnel Name", "Visibility", "Created By", "Created Date", "Last Updated", "Actions"].map((col, i) => (
              <div key={i} className="px-4 py-3 border-r border-[#ededed] last:border-0">
                <span className="text-[12px] font-semibold text-[#212121]">{col}</span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((funnel, ri) => (
            <div
              key={funnel.id}
              className="grid border-b border-[#f5f5f5] last:border-0 group relative hover:bg-[#EDF9FF] transition-colors"
              style={{
                gridTemplateColumns: TABLE_COLS,
                background: ri % 2 === 1 ? "#FAFAFA" : "#FFFFFF",
              }}
            >
              <div className="px-4 py-3 flex items-center border-r border-[#f5f5f5]">
                <button
                  onClick={() => navigate(`/funnel/${funnel.id}`)}
                  className="text-[13px] text-[#006bff] font-medium hover:underline text-left"
                >
                  {funnel.name}
                </button>
              </div>
              <div className="px-4 py-3 flex items-center border-r border-[#f5f5f5]">
                <FunnelVisibilityChip
                  visibility={funnel.visibility}
                  canEdit={funnel.createdBy === currentUserName}
                  onToggle={() => toggleVisibility(funnel.id)}
                />
              </div>
              <div className="px-4 py-3 flex items-center border-r border-[#f5f5f5]">
                <span className="text-[13px] text-[#212121]">{funnel.createdBy}</span>
              </div>
              <div className="px-4 py-3 flex items-center border-r border-[#f5f5f5]">
                <span className="text-[13px] text-[#212121]">{funnel.createdDate}</span>
              </div>
              <div className="px-4 py-3 flex items-center border-r border-[#f5f5f5]">
                <span className="text-[13px] text-[#212121]">{funnel.lastUpdated}</span>
              </div>
              <div className="px-2 py-3 flex items-center justify-center relative">
                <button
                  onClick={() => setOpenMenu(openMenu === funnel.id ? null : funnel.id)}
                  className="opacity-100 size-8 flex items-center justify-center rounded hover:bg-[#f5f5f5] transition-all"
                >
                  <svg className="w-5 h-3" fill="none" viewBox="0 0 20 3">
                    <path d="M11.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm7-1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-17 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" fill="#212121" />
                  </svg>
                </button>
                {openMenu === funnel.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                    <div className="absolute right-8 top-2 z-20 bg-white border border-[#ededed] rounded-lg shadow-lg py-1 w-36">
                      {(["view", "edit", "duplicate", "export"] as MenuItem[]).map((action) => (
                        <button
                          key={action}
                          onClick={() => handleAction(action, funnel.id)}
                          className="w-full text-left px-4 py-2 text-[13px] text-[#212121] hover:bg-[#f5f5f5] capitalize transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                      <div className="h-px bg-[#ededed] my-1" />
                      <button
                        onClick={() => handleAction("delete", funnel.id)}
                        className="w-full text-left px-4 py-2 text-[13px] text-red-600 hover:bg-[#fff5f5] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-16 text-center text-[14px]" style={{ color: "#8A8A8A" }}>
              No funnels found.
            </div>
          )}

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-[#f5f5f5] bg-[#fafafa]">
              <span className="text-[12px]" style={{ color: "#8A8A8A" }}>
                Showing 1–{filtered.length} of {filtered.length} funnels
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FunnelVisibilityChip({
  visibility,
  canEdit,
  onToggle,
}: {
  visibility: FunnelVisibility;
  canEdit: boolean;
  onToggle: () => void;
}) {
  const isPublic = visibility === "public";
  const tip = canEdit
    ? isPublic
      ? "Click to make visible to Only me"
      : "Click to make Public"
    : "Only the funnel creator can change visibility";

  return (
    <TinyTooltip text={tip}>
      <button
        type="button"
        onClick={() => {
          if (canEdit) onToggle();
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-[3px] text-[12px] font-medium leading-tight ${
          canEdit ? "cursor-pointer hover:brightness-[0.98]" : "cursor-default"
        }`}
        style={{
          background: isPublic ? "#DBEAFE" : "#F3F4F6",
          color: isPublic ? "#1E40AF" : "#6B7280",
        }}
        aria-label={isPublic ? "Public. Click to change to Only me." : "Only me. Click to change to Public."}
        aria-pressed={isPublic}
      >
        {isPublic ? (
          <Globe className="size-3.5 shrink-0" strokeWidth={2} aria-hidden style={{ color: "#1E40AF" }} />
        ) : (
          <Lock className="size-3.5 shrink-0" strokeWidth={2} aria-hidden style={{ color: "#6B7280" }} />
        )}
        {isPublic ? "Public" : "Only Me"}
      </button>
    </TinyTooltip>
  );
}
