import React, { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { FunnelStep } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared row styles ─────────────────────────────────────────────────────────

const ROW_BASE: React.CSSProperties = {
  display: "grid",
  alignItems: "center",
  borderBottom: "1px solid #F3F4F6",
  transition: "background 0.12s ease",
  cursor: "default",
};

// ── Export button ─────────────────────────────────────────────────────────────

function ExportButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      title="Download"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: 8,
        border: "1.5px solid #E5E7EB",
        background: hovered ? "#F3F4F6" : "white",
        color: hovered ? "#4F83F1" : "#9CA3AF",
        cursor: "pointer",
        transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
        borderColor: hovered ? "#C5D5F8" : "#E5E7EB",
        flexShrink: 0,
      }}
    >
      {/* Download icon */}
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
    </button>
  );
}

// ── Table 1: Events ───────────────────────────────────────────────────────────

function buildUsers(length: number) {
  const base = 142500;
  const ratioByIndex = [1, 82400 / 142500, 17600 / 142500];
  return Array.from({ length }, (_, i) => {
    const ratio =
      ratioByIndex[i] ??
      Math.max(0.02, ratioByIndex[ratioByIndex.length - 1] * Math.pow(0.55, i - (ratioByIndex.length - 1)));
    return Math.max(900, Math.round(base * ratio));
  });
}

function EventsTable({ steps, funnelName }: { steps: FunnelStep[]; funnelName: string }) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const users = buildUsers(steps.length);

  const eventsData = steps.map((step, index) => ({
    name: step.eventName || `Step ${index + 1}`,
    eventCount: Math.round(users[index] * 1.24),
    uniqueUsers: users[index],
  }));

  const handleExport = () => {
    const headers = ["EVENT NAME", "EVENT COUNT", "UNIQUE USERS", "WEB", "API", "IOS", "ANDROID"];
    const rows = eventsData.map((r) => [r.name, fmt(r.eventCount), fmt(r.uniqueUsers), "—", "—", "—", "—"]);
    downloadCSV(`funnel-events-${funnelName || "New Funnel"}.csv`, rows, headers);
  };

  const columns = [
    { key: "eventName", label: "EVENT NAME", align: "left" as const },
    { key: "eventCount", label: "EVENT COUNT", align: "right" as const },
    { key: "uniqueUsers", label: "UNIQUE USERS", align: "right" as const },
    { key: "web", label: "WEB", align: "right" as const },
    { key: "api", label: "API", align: "right" as const },
    { key: "ios", label: "IOS", align: "right" as const },
    { key: "android", label: "ANDROID", align: "right" as const },
  ];
  const COL = "minmax(180px, 2fr) repeat(6, minmax(90px, 1fr))";

  return (
    <div style={{
      background: "white",
      borderRadius: 14,
      border: "1px solid #E5E7EB",
      overflow: "hidden",
    }}>
      {/* Card header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 24px",
        borderBottom: "1px solid #F0F0F0",
      }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#374151" }}>
          Showing events for{" "}
          <span style={{ color: "#4F83F1", fontWeight: 600 }}>{funnelName || "New Funnel"}</span>
        </p>
        <ExportButton onClick={handleExport} />
      </div>

      {/* Column headers */}
      <div style={{
        ...ROW_BASE,
        gridTemplateColumns: COL,
        columnGap: 14,
        padding: "0 24px",
        height: 44,
        background: "#FAFAFA",
        borderBottom: "1px solid #EBEBEB",
      }}>
        {columns.map((column) => (
          <span key={column.key} style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#9CA3AF",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textAlign: column.align,
            lineHeight: "16px",
          }}>
            {column.label}
          </span>
        ))}
      </div>

      {/* Rows */}
      {eventsData.map((row, i) => (
        <div
          key={row.name}
          onMouseEnter={() => setHoveredRow(i)}
          onMouseLeave={() => setHoveredRow(null)}
          style={{
            ...ROW_BASE,
            gridTemplateColumns: COL,
            columnGap: 14,
            padding: "0 24px",
            height: 56,
            background: hoveredRow === i ? "#F7F8FA" : "white",
            borderBottom: i < eventsData.length - 1 ? "1px solid #F3F4F6" : "none",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: "#111827", textAlign: "left" }}>{row.name}</span>
          <span style={{ fontSize: 14, color: "#374151", textAlign: "right" }}>{fmt(row.eventCount)}</span>
          <span style={{ fontSize: 14, color: "#374151", textAlign: "right" }}>{fmt(row.uniqueUsers)}</span>
          <span style={{ fontSize: 14, color: "#D1D5DB", fontWeight: 600, textAlign: "right" }}>—</span>
          <span style={{ fontSize: 14, color: "#D1D5DB", fontWeight: 600, textAlign: "right" }}>—</span>
          <span style={{ fontSize: 14, color: "#D1D5DB", fontWeight: 600, textAlign: "right" }}>—</span>
          <span style={{ fontSize: 14, color: "#D1D5DB", fontWeight: 600, textAlign: "right" }}>—</span>
        </div>
      ))}
    </div>
  );
}

// ── Table 2: Dropped-off Users by Step ───────────────────────────────────────

function DroppedOffTable({ steps }: { steps: FunnelStep[] }) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [expanded, setExpanded]     = useState(true);
  const users = buildUsers(steps.length);

  const dropoffData = steps
    .slice(0, -1)
    .map((step, index) => {
      const next = steps[index + 1];
      const dropped = Math.max(0, users[index] - users[index + 1]);
      const pct = users[index] ? Math.round((dropped / users[index]) * 100) : 0;
      return {
        step: `${step.eventName || `Step ${index + 1}`} → ${next.eventName || `Step ${index + 2}`}`,
        usersDropped: dropped,
        dropOffPct: `${pct}%`,
      };
    });

  const COL = "1fr 200px 160px";

  return (
    <div style={{
      background: "white",
      borderRadius: 14,
      border: "1px solid #E5E7EB",
      overflow: "hidden",
    }}>
      {/* Card header */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: expanded ? "1px solid #F0F0F0" : "none",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
          Dropped-off Users by Step
        </p>
        <span style={{ color: "#9CA3AF", display: "flex" }}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </div>

      {expanded && (
        <>
          {/* Column headers */}
          <div style={{
            ...ROW_BASE,
            gridTemplateColumns: COL,
            padding: "0 24px",
            height: 44,
            background: "#FAFAFA",
            borderBottom: "1px solid #EBEBEB",
          }}>
            {["STEP NAME", "USERS DROPPED", "DROP-OFF %"].map((h) => (
              <span key={h} style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#9CA3AF",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}>
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {dropoffData.map((row, i) => (
            <div
              key={row.step}
              onMouseEnter={() => setHoveredRow(i)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                ...ROW_BASE,
                gridTemplateColumns: COL,
                padding: "0 24px",
                height: 56,
                background: hoveredRow === i ? "#F7F8FA" : "white",
                borderBottom: i < dropoffData.length - 1 ? "1px solid #F3F4F6" : "none",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{row.step}</span>
              <span style={{ fontSize: 14, color: "#374151" }}>{fmt(row.usersDropped)}</span>
              <span style={{ fontSize: 14, color: "#374151" }}>{row.dropOffPct}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function FunnelTables({
  steps,
  animationKey = 0,
  delayMs = 0,
  funnelName,
}: {
  steps: FunnelStep[];
  animationKey?: number;
  delayMs?: number;
  funnelName: string;
}) {
  if (steps.length === 0) return null;

  return (
    <div
      key={`${animationKey}-${steps.map((step) => step.id).join("-")}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        marginTop: 20,
        opacity: 0,
        animation: `tables-fade-in 220ms ease-out ${delayMs}ms forwards`,
      }}
    >
      <style>
        {`@keyframes tables-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }`}
      </style>
      <EventsTable steps={steps} funnelName={funnelName} />
      <DroppedOffTable steps={steps} />
    </div>
  );
}
