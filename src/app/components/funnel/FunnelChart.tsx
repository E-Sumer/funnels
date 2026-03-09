import { useState } from "react";

export interface FunnelStep {
  name: string;
  users: number;
  pct?: number;
}

interface FunnelChartProps {
  steps: FunnelStep[];
}

function formatEU(n: number) {
  // European format: dot as thousands separator
  return n.toLocaleString("de-DE");
}

export function FunnelChart({ steps }: FunnelChartProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const maxUsers = steps[0]?.users ?? 1;
  const CHART_H = 200;
  const Y_LABELS = [100, 80, 60, 40, 20];

  const enriched = steps.map((s, i) => ({
    ...s,
    pct: i === 0 ? 100 : Math.round((s.users / maxUsers) * 100),
  }));

  return (
    <div className="w-full select-none">
      <div className="flex">
        {/* Y-axis */}
        <div
          className="flex flex-col justify-between text-right pr-3 shrink-0"
          style={{ width: 44, height: CHART_H }}
        >
          {Y_LABELS.map((v) => (
            <span
              key={v}
              className="text-[12px] leading-none"
              style={{ color: "#8A8A8A" }}
            >
              {v}%
            </span>
          ))}
        </div>

        {/* Chart body */}
        <div className="flex-1 relative" style={{ height: CHART_H }}>
          {/* Horizontal grid lines */}
          {Y_LABELS.map((v, i) => (
            <div
              key={v}
              className="absolute left-0 right-0"
              style={{
                top: `${i * 25}%`,
                borderTop: "1px solid #F5F5F5",
              }}
            />
          ))}
          <div
            className="absolute left-0 right-0"
            style={{ bottom: 0, borderTop: "1px solid #EDEDED" }}
          />

          {/* Bar columns */}
          <div className="absolute inset-0 flex">
            {enriched.map((step, i) => {
              const barH = (step.pct / 100) * CHART_H;
              const isHovered = hoveredBar === i;

              return (
                <div
                  key={i}
                  className="flex-1 flex items-end relative"
                  style={{ height: CHART_H }}
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Floating label above bar */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bg-white border border-[#ededed] rounded px-2 py-1 text-center shadow-sm z-10 pointer-events-none"
                    style={{ bottom: barH + 8 }}
                  >
                    <div
                      className="text-[13px] font-semibold leading-[18px] whitespace-nowrap"
                      style={{ color: "#212121" }}
                    >
                      {step.pct}%
                    </div>
                    <div
                      className="text-[12px] leading-[18px] whitespace-nowrap"
                      style={{ color: "#8A8A8A" }}
                    >
                      {formatEU(step.users)}
                    </div>
                  </div>

                  {/* Blue bar */}
                  <div
                    className="w-full transition-colors duration-100"
                    style={{
                      height: barH,
                      background: isHovered ? "#0057D4" : "#006BFF",
                    }}
                  />

                  {/* Hover action menu */}
                  {isHovered && (
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 bg-white border border-[#ededed] rounded-lg shadow-xl py-1 w-44 z-20"
                      style={{ marginBottom: barH + 56 }}
                    >
                      {["View Users", "Tag Users"].map((action) => (
                        <button
                          key={action}
                          className="w-full text-left px-4 py-2 text-[13px] text-[#212121] hover:bg-[#f5f5f5] transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step name labels below chart */}
      <div className="flex" style={{ paddingLeft: 44 }}>
        {enriched.map((step, i) => (
          <div key={i} className="flex-1 text-center pt-3">
            <p
              className="text-[12px] leading-[18px] truncate px-2"
              style={{ color: "#8A8A8A" }}
            >
              {step.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
