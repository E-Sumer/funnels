import React, { type CSSProperties, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FunnelVisualization } from "../components/funnel/FunnelVisualization";
import { FunnelTables } from "../components/funnel/FunnelTables";
import { AudienceFilterSheet, type Filter as AudienceFilter } from "../components/funnel/AudienceFilterSheet";
import { ConfigureFunnelSidebar } from "../components/funnel/ConfigureFunnelSidebar";
import { DateRangePicker, type DateRangePickerHandle } from "../components/funnel/DateRangePicker";
import type { FunnelDateRange, FunnelExclusionConfig, FunnelOrderMode, FunnelStep } from "../components/funnel/types";

// ─── Small icons for the stats ────────────────────────────────────────────────
function ClockIcon() {
  return (
    <svg className="size-4 shrink-0" fill="none" viewBox="0 0 16 16" style={{ color: "#8A8A8A" }}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.5v3.5l2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg className="size-4 shrink-0" fill="none" viewBox="0 0 16 16" style={{ color: "#8A8A8A" }}>
      <path d="M1.5 11.5L6 6.5l3 3 5.5-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function FunnelAnalysisPage() {
  const navigate = useNavigate();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  const [showAudience, setShowAudience] = useState(false);
  const [funnelName, setFunnelName] = useState("Netmera test app funnel stats");
  const [editingFunnelName, setEditingFunnelName] = useState(false);
  const [funnelNameDraft, setFunnelNameDraft] = useState("Netmera test app funnel stats");
  const [funnelDescription, setFunnelDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const funnelNameSnapshotRef = useRef("Netmera test app funnel stats");
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [dateRange, setDateRange] = useState<FunnelDateRange>({ start: defaultYesterday, end: defaultYesterday });
  const [conversionWindow, setConversionWindow] = useState("24");
  const [conversionUnit, setConversionUnit] = useState("Hours");
  const [countingMethod, setCountingMethod] = useState("Unique Users");
  const [orderMode, setOrderMode] = useState<FunnelOrderMode>("In this order");
  const [exclusionConfig, setExclusionConfig] = useState<FunnelExclusionConfig>({
    enabled: false,
    eventName: "",
    filters: [],
    scope: "All Steps",
  });
  const [audienceFilters, setAudienceFilters] = useState<AudienceFilter[]>([]);
  const [rightPanelLoading, setRightPanelLoading] = useState(false);
  const [visualizationAnimKey, setVisualizationAnimKey] = useState(0);
  const [tablesAnimKey, setTablesAnimKey] = useState(0);
  const loadingTimerRef = useRef<number | null>(null);
  const datePickerRef = useRef<DateRangePickerHandle>(null);

  const triggerRightPanelRefresh = () => {
    setRightPanelLoading(true);
    if (loadingTimerRef.current !== null) {
      window.clearTimeout(loadingTimerRef.current);
    }
    loadingTimerRef.current = window.setTimeout(() => {
      setRightPanelLoading(false);
      setVisualizationAnimKey((v) => v + 1);
      setTablesAnimKey((v) => v + 1);
    }, 900);
  };

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current !== null) {
        window.clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  const addFirstStep = () => {
    if (steps.length > 0) return;
    setSteps([{ id: 1, eventName: "", filters: [], showExclude: false, excludeValue: "" }]);
    setVisualizationAnimKey((v) => v + 1);
    setTablesAnimKey((v) => v + 1);
  };
  const saveFunnelName = () => {
    const trimmed = funnelNameDraft.trim();
    if (!trimmed) {
      setFunnelNameDraft(funnelName);
      setEditingFunnelName(false);
      return;
    }
    setFunnelName(trimmed);
    funnelNameSnapshotRef.current = trimmed;
    setEditingFunnelName(false);
  };
  const saveFunnelDescription = () => {
    setFunnelDescription(descriptionDraft.trim());
    setEditingDescription(false);
  };
  const liveFunnelName = editingFunnelName ? funnelNameDraft : funnelName;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FAFAFA] font-sans">
      {/* ── Utility bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-end shrink-0 border-b border-[#EDEDED]"
        style={{ height: 26, background: "#FFFFFF" }}
      >
        <button className="text-[11px] font-medium px-4 h-full border-r border-[#EDEDED] hover:bg-[#FAFAFA] transition-colors" style={{ color: "#8A8A8A" }}>
          Add favorite
        </button>
        <button className="text-[11px] font-medium px-5 h-full hover:bg-[#FAFAFA] transition-colors" style={{ color: "#8A8A8A" }}>
          Report a bug
        </button>
      </div>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 shrink-0 bg-white border-b border-[#F5F5F5]" style={{ height: 54 }}>
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-7 bg-[#3B82F6] rounded-full" />
          <div className="flex flex-col">
            {editingFunnelName ? (
              <input
                autoFocus
                value={funnelNameDraft}
                onChange={(event) => {
                  setFunnelNameDraft(event.target.value);
                  setFunnelName(event.target.value);
                }}
                onBlur={saveFunnelName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveFunnelName();
                  if (event.key === "Escape") {
                    setFunnelNameDraft(funnelNameSnapshotRef.current);
                    setFunnelName(funnelNameSnapshotRef.current);
                    setEditingFunnelName(false);
                  }
                }}
                className="text-[16px] font-bold text-[#3B82F6] leading-tight bg-transparent border border-[#BFDBFE] rounded px-1 -mx-1 outline-none"
              />
            ) : (
              <h1
                className="text-[16px] font-bold text-[#3B82F6] leading-tight cursor-text"
                onClick={() => {
                  funnelNameSnapshotRef.current = funnelName;
                  setFunnelNameDraft(funnelName);
                  setEditingFunnelName(true);
                }}
                title="Click to edit funnel name"
              >
                {liveFunnelName}
              </h1>
            )}
            {editingDescription ? (
              <input
                autoFocus
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                onBlur={saveFunnelDescription}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveFunnelDescription();
                  if (event.key === "Escape") {
                    setDescriptionDraft(funnelDescription);
                    setEditingDescription(false);
                  }
                }}
                className="text-[11px] font-semibold text-[#8A8A8A] mt-0.5 bg-transparent border border-[#E5E7EB] rounded px-1 -mx-1 outline-none"
              />
            ) : (
              <p
                className="text-[11px] font-semibold text-[#8A8A8A] mt-0.5 cursor-text"
                onClick={() => {
                  setDescriptionDraft(funnelDescription);
                  setEditingDescription(true);
                }}
              >
                {funnelDescription || "Add a short description for this funnel (optional)"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="h-8 px-5 bg-[#4AB98F] rounded-lg text-[12px] text-white font-semibold hover:bg-[#3FA87E] transition-all shadow-sm"
          >
            Finish
          </button>
        </div>
      </div>

      {/* ── Secondary Controls & Stats ───────────────────────────────────────── */}
      <div className="bg-white border-b border-[#F0F0F0] px-5 py-2 flex items-center shadow-sm" style={{ overflow: "visible" }}>
        <DateRangePicker
          ref={datePickerRef}
          onRangeApply={(range) => {
            setDateRange(range);
            triggerRightPanelRefresh();
          }}
        />
      </div>

      {/* ── Scrollable content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-[400px_minmax(0,1fr)] gap-4 items-start">
            <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
              <ConfigureFunnelSidebar
                open
                onClose={() => {}}
                onOpenAudienceFilter={() => { setShowAudience(true); }}
                steps={steps}
                dateRange={dateRange}
                conversionWindow={conversionWindow}
                conversionUnit={conversionUnit}
                countingMethod={countingMethod}
                orderMode={orderMode}
                exclusionConfig={exclusionConfig}
                onStepsChange={(next) => {
                  const lengthChanged = next.length !== steps.length;
                  setSteps(next);
                  if (lengthChanged) {
                    triggerRightPanelRefresh();
                  } else {
                    setVisualizationAnimKey((v) => v + 1);
                    setTablesAnimKey((v) => v + 1);
                  }
                }}
                onGlobalRulesChange={(next) => {
                  if (next.conversionWindow !== undefined) setConversionWindow(next.conversionWindow);
                  if (next.conversionUnit !== undefined) setConversionUnit(next.conversionUnit);
                  if (next.countingMethod !== undefined) setCountingMethod(next.countingMethod);
                  if (next.orderMode !== undefined) setOrderMode(next.orderMode);
                  if (next.exclusionConfig !== undefined) setExclusionConfig(next.exclusionConfig);
                }}
                onAddFirstStep={addFirstStep}
                onRequestRightPanelRefresh={triggerRightPanelRefresh}
                onOpenDatePicker={() => datePickerRef.current?.open()}
                audienceFilterCount={audienceFilters.length}
              />
            </div>
            <div>
              {rightPanelLoading ? (
                <RightPanelSkeleton stepCount={steps.length} />
              ) : steps.length === 0 ? (
                <FunnelEmptyState />
              ) : (
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <FunnelVisualization
                    steps={steps}
                    animationKey={visualizationAnimKey}
                    compact={false}
                    orderMode={orderMode}
                    conversionWindow={conversionWindow}
                    conversionUnit={conversionUnit}
                    exclusionConfig={exclusionConfig}
                  />
                  <FunnelTables
                    steps={steps}
                    animationKey={tablesAnimKey}
                    delayMs={80}
                    funnelName={liveFunnelName || "New Funnel"}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs and Sheets */}
      <AudienceFilterSheet
        open={showAudience}
        onClose={() => setShowAudience(false)}
        onApply={(filters) => {
          setAudienceFilters(filters);
          triggerRightPanelRefresh();
        }}
      />
    </div>
  );
}

function FunnelEmptyState() {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        border: "1px solid #E5E7EB",
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
          Funnel Visualization
        </p>
      </div>
      <div
        style={{
          border: "1px dashed #D1D5DB",
          borderRadius: 12,
          background: "#FAFAFC",
          padding: "28px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "flex-end", marginBottom: 14 }}>
          <div style={{ width: 70, height: 64, background: "#E5E7EB", borderRadius: 5 }} />
          <div style={{ width: 62, height: 44, background: "#E5E7EB", borderRadius: 5 }} />
          <div style={{ width: 54, height: 28, background: "#E5E7EB", borderRadius: 5 }} />
        </div>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
          Start building your funnel
        </p>
        <p style={{ margin: "8px 0 14px", fontSize: 13, color: "#6B7280" }}>
          Add your first step to begin.
        </p>
      </div>
    </div>
  );
}

function RightPanelSkeleton({ stepCount }: { stepCount: number }) {
  const shimmerStyle: CSSProperties = {
    background: "linear-gradient(90deg, #F3F4F6 15%, #ECEFF4 45%, #F3F4F6 75%)",
    backgroundSize: "240% 100%",
    animation: "funnel-shimmer 1.3s ease-in-out infinite",
  };
  const chartSteps = Math.max(1, Math.min(10, stepCount || 4));
  const eventRows = Math.max(3, stepCount || 0);
  const dropRows = Math.max(1, (stepCount || 2) - 1);
  const barHeights = Array.from({ length: chartSteps }, (_, idx) => Math.max(30, 122 - idx * 14));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>
        {`@keyframes funnel-shimmer {
          0% { background-position: 140% 0; }
          100% { background-position: -140% 0; }
        }`}
      </style>
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 22 }}>
        <div style={{ ...shimmerStyle, width: 150, height: 16, borderRadius: 6, marginBottom: 16 }} />
        <div style={{ border: "1px solid #EEF0F4", borderRadius: 10, padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${chartSteps}, minmax(0, 1fr))`, alignItems: "end", gap: 10 }}>
            {barHeights.map((height, idx) => (
              <div key={idx} style={{ ...shimmerStyle, width: "100%", height, borderRadius: 5 }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 18 }}>
        <div style={{ ...shimmerStyle, width: 240, height: 14, borderRadius: 6, marginBottom: 12 }} />
        {Array.from({ length: eventRows }).map((_, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.6fr 0.6fr", gap: 12, marginBottom: 10 }}>
            {Array.from({ length: 5 }).map((__, colIdx) => (
              <div key={colIdx} style={{ ...shimmerStyle, height: 12, borderRadius: 6 }} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 18 }}>
        <div style={{ ...shimmerStyle, width: 210, height: 14, borderRadius: 6, marginBottom: 12 }} />
        {Array.from({ length: dropRows }).map((_, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, marginBottom: 10 }}>
            {Array.from({ length: 3 }).map((__, colIdx) => (
              <div key={colIdx} style={{ ...shimmerStyle, height: 12, borderRadius: 6 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}