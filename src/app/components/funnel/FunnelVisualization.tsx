import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { FunnelExclusionConfig, FunnelOrderMode, FunnelStep } from "./types";

const CHART_H = 220;
const MIN_BAR_H = 36;
const LABEL_H = 84;
const PAD_X = 20;
const PAD_TOP = 8;
const VB_W = 980;
const STEP_POPUP_W = 260;
const DROPOFF_POPUP_W = 252;
const COLLAPSED_VISIBLE_STEPS = 4;

interface StepViewModel {
  id: string;
  name: string;
  rawValue: number;
  countLabel: string;
  pctFromFirst: string;
  attributeLabel: string;
}

interface FunnelVisualizationProps {
  steps: FunnelStep[];
  animationKey?: number;
  compact?: boolean;
  orderMode: FunnelOrderMode;
  conversionWindow: string;
  conversionUnit: string;
  exclusionConfig: FunnelExclusionConfig;
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return `${Math.round(rounded)}%`;
  return `${rounded.toFixed(1)}%`;
}

function formatDropoffPercent(value: number) {
  const pct = Math.max(0, value);
  if (pct >= 10) {
    const rounded = Math.round(pct * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.001) return `${Math.round(rounded)}%`;
    return `${rounded.toFixed(1)}%`;
  }
  return `${(Math.round(pct * 10) / 10).toFixed(1)}%`;
}

function estimateMetricLabelWidth(percentText: string, countText: string) {
  return Math.max(56, Math.min(136, Math.max(percentText.length, countText.length) * 7 + 24));
}

function rectsOverlap(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
) {
  return !(
    a.left + a.width <= b.left ||
    b.left + b.width <= a.left ||
    a.top + a.height <= b.top ||
    b.top + b.height <= a.top
  );
}

function truncateLabel(value: string, maxChars = 24) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

function getAttributeAxisLabel(step: FunnelStep) {
  if (!step.filters?.length) return "";
  const first = step.filters[0]?.label?.trim() ?? "";
  if (!first) return "";
  const remaining = step.filters.length - 1;
  return remaining > 0 ? `${first} +${remaining}` : first;
}

function toHours(windowValue: string, unit: string) {
  const amount = Number(windowValue) || 0;
  const multipliers: Record<string, number> = {
    Seconds: 1 / 3600,
    Minutes: 1 / 60,
    Hours: 1,
    Days: 24,
    Weeks: 24 * 7,
    Months: 24 * 30,
    Sessions: 2,
  };
  return amount * (multipliers[unit] ?? 1);
}

function parseScope(scope: string) {
  if (scope === "All Steps") return { all: true, startIndex: 0 };
  const match = scope.match(/^Step (\d+) → (\d+)$/);
  if (!match) return { all: true, startIndex: 0 };
  const to = Math.max(1, Number(match[2]));
  return { all: false, startIndex: to - 1 };
}

function deriveSteps(
  steps: FunnelStep[],
  exclusionConfig: FunnelExclusionConfig,
  orderMode: FunnelOrderMode,
  conversionWindow: string,
  conversionUnit: string,
): StepViewModel[] {
  const base = 142500;
  const ratioByIndex = [1, 82400 / 142500, 17600 / 142500];
  const baseValues = steps.map((_, index) => {
    const ratio =
      ratioByIndex[index] ??
      Math.max(0.02, ratioByIndex[ratioByIndex.length - 1] * Math.pow(0.55, index - (ratioByIndex.length - 1)));
    return Math.max(900, Math.round(base * ratio));
  });
  const values = [...baseValues];
  if (exclusionConfig.enabled && exclusionConfig.eventName) {
    const scope = parseScope(exclusionConfig.scope);
    const eventSeed = exclusionConfig.eventName
      .split("")
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const eventFactor = 0.12 + (eventSeed % 22) / 100;
    const filterFactor = Math.min(0.28, exclusionConfig.filters.length * 0.05);
    const orderFactor = orderMode === "In strict order" ? 0.08 : orderMode === "Any order" ? -0.03 : 0;
    const windowHours = Math.max(1, toHours(conversionWindow, conversionUnit));
    const windowFactor = Math.min(0.18, Math.log10(windowHours + 1) * 0.12);
    const scopeFactor = scope.all ? 0.16 : 0.08;
    const impact = Math.min(0.98, Math.max(0.08, eventFactor + filterFactor + orderFactor + windowFactor + scopeFactor));
    const multiplier = Math.max(0, 1 - impact);
    for (let i = Math.max(0, scope.startIndex); i < values.length; i += 1) {
      values[i] = Math.max(0, Math.round(values[i] * multiplier));
    }
    if (impact > 0.92) {
      for (let i = Math.max(0, scope.startIndex); i < values.length; i += 1) values[i] = 0;
    }
  }
  const firstValue = Math.max(1, values[0] ?? 1);
  return steps.map((step, index) => {
    const value = Math.max(0, values[index] ?? 0);
    return {
      id: String(step.id),
      name: step.eventName || `Step ${index + 1}`,
      rawValue: value,
      countLabel: formatCount(value),
      pctFromFirst: index === 0 ? "100%" : formatPercent((value / firstValue) * 100),
      attributeLabel: getAttributeAxisLabel(step),
    };
  });
}

function getHorizontalLayout(stepCount: number, expanded: boolean) {
  const count = Math.max(stepCount, 1);
  if (expanded) {
    const bar = 152;
    const gap = 86;
    const required = PAD_X * 2 + count * bar + Math.max(0, count - 1) * gap;
    return { barWidth: bar, gapWidth: gap, vbWidth: Math.max(VB_W, required) };
  }

  const contentWidth = VB_W - PAD_X * 2;
  // Keep a stable chart canvas in collapsed mode; only horizontal geometry adapts.
  let gap = Math.min(96, Math.max(24, 84 - Math.max(0, count - 3) * 7));
  let bar = (contentWidth - gap * (count - 1)) / count;

  if (bar < 82) {
    bar = 82;
    gap = (contentWidth - bar * count) / Math.max(1, count - 1);
  }
  if (gap < 16) {
    gap = 16;
    bar = (contentWidth - gap * (count - 1)) / count;
  }
  return { barWidth: bar, gapWidth: gap, vbWidth: VB_W };
}

export function FunnelVisualization({
  steps,
  compact = false,
  orderMode,
  conversionWindow,
  conversionUnit,
  exclusionConfig,
}: FunnelVisualizationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const viewStepsAll = useMemo(
    () => deriveSteps(steps, exclusionConfig, orderMode, conversionWindow, conversionUnit),
    [steps, exclusionConfig, orderMode, conversionWindow, conversionUnit],
  );
  const isExpandable = viewStepsAll.length > COLLAPSED_VISIBLE_STEPS;
  const viewSteps = useMemo(
    () =>
      isExpandable && !isExpanded
        ? viewStepsAll.slice(0, COLLAPSED_VISIBLE_STEPS)
        : viewStepsAll,
    [isExpandable, isExpanded, viewStepsAll],
  );
  const hiddenStepCount = Math.max(0, viewStepsAll.length - COLLAPSED_VISIBLE_STEPS);
  const dropoffData = useMemo(
    () =>
      viewSteps.slice(0, -1).map((step, index) => {
        const next = viewSteps[index + 1];
        const dropped = Math.max(0, step.rawValue - next.rawValue);
        return {
          from: step.name,
          to: next.name,
          pct: formatDropoffPercent((dropped / Math.max(1, step.rawValue)) * 100),
          dropCount: dropped.toLocaleString("en-US"),
          totalCount: step.rawValue.toLocaleString("en-US"),
          label: formatCount(dropped),
        };
      }),
    [viewSteps],
  );
  const dropoffDataAll = useMemo(
    () =>
      viewStepsAll.slice(0, -1).map((step, index) => {
        const next = viewStepsAll[index + 1];
        const dropped = Math.max(0, step.rawValue - next.rawValue);
        return {
          from: step.name,
          to: next.name,
          pct: formatDropoffPercent((dropped / Math.max(1, step.rawValue)) * 100),
          dropCount: dropped.toLocaleString("en-US"),
          totalCount: step.rawValue.toLocaleString("en-US"),
          label: formatCount(dropped),
        };
      }),
    [viewStepsAll],
  );

  const { barWidth, gapWidth, vbWidth } = useMemo(
    () => getHorizontalLayout(viewSteps.length, isExpanded),
    [viewSteps.length, isExpanded],
  );
  const expandedLayout = useMemo(
    () => getHorizontalLayout(viewStepsAll.length, true),
    [viewStepsAll.length],
  );

  const vbHeight = PAD_TOP + CHART_H + LABEL_H;
  const baseline = PAD_TOP + CHART_H;
  const overallConversionLabel = useMemo(() => {
    if (viewStepsAll.length < 2) return null;
    const first = viewStepsAll[0]?.rawValue ?? 0;
    const last = viewStepsAll[viewStepsAll.length - 1]?.rawValue ?? 0;
    if (!first) return "Total conversion: —";
    return `Total conversion: ${formatPercent((last / first) * 100)} (Step 1 → Step ${viewStepsAll.length})`;
  }, [viewStepsAll]);

  const renderedH = (rawValue: number) =>
    Math.max((rawValue / (viewSteps[0]?.rawValue || 1)) * CHART_H, MIN_BAR_H);
  const barXvb = (i: number) => PAD_X + i * (barWidth + gapWidth);
  const barYvb = (rawValue: number) => PAD_TOP + CHART_H - renderedH(rawValue);

  if (viewSteps.length === 0) {
    return null;
  }
  const isAllExcluded = viewStepsAll.length > 0 && viewStepsAll.every((step) => step.rawValue === 0);

  // Step bar hover / menu
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [activeStepMenu, setActiveStepMenu] = useState<number | null>(null);
  const [stepMenuPos, setStepMenuPos] = useState({ left: 0, top: 0 });

  // Drop-off zone hover / menu
  const [hoveredDropoff, setHoveredDropoff] = useState<number | null>(null);
  const [hoveredDropoffLabel, setHoveredDropoffLabel] = useState<number | null>(null);
  const [activeDropoffMenu, setActiveDropoffMenu] = useState<number | null>(null);
  const [dropoffMenuPos, setDropoffMenuPos] = useState({ left: 0, top: 0 });
  const [expandedHoveredStep, setExpandedHoveredStep] = useState<number | null>(null);
  const [expandedHoveredDropoff, setExpandedHoveredDropoff] = useState<number | null>(null);
  const [expandedHoveredDropoffLabel, setExpandedHoveredDropoffLabel] = useState<number | null>(null);
  const [expandedActiveStepMenu, setExpandedActiveStepMenu] = useState<number | null>(null);
  const [expandedActiveDropoffMenu, setExpandedActiveDropoffMenu] = useState<number | null>(null);
  const [expandedStepMenuPos, setExpandedStepMenuPos] = useState({ left: 0, top: 0 });
  const [expandedDropoffMenuPos, setExpandedDropoffMenuPos] = useState({ left: 0, top: 0 });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const expandedSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!isExpandable && isExpanded) setIsExpanded(false);
  }, [isExpandable, isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExpanded]);

  // Convert viewBox (vbX, vbY) → pixel position relative to wrapperRef
  const vbToPx = useCallback((vbX: number, vbY: number) => {
    if (!svgRef.current || !wrapperRef.current) return { left: 0, top: 0 };
    const svgRect = svgRef.current.getBoundingClientRect();
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const scale = svgRect.width / vbWidth;
    return {
      left: (svgRect.left - wrapperRect.left) + vbX * scale,
      top:  (svgRect.top  - wrapperRect.top)  + vbY * scale,
    };
  }, [vbWidth]);

  const closeAll = () => {
    setActiveStepMenu(null);
    setActiveDropoffMenu(null);
  };

  // Open step ⋮ menu
  const openStepMenu = useCallback((i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeStepMenu === i) { setActiveStepMenu(null); return; }
    setActiveDropoffMenu(null);
    const bX = barXvb(i);
    const bY = barYvb(viewSteps[i].rawValue);
    const pos = vbToPx(bX + barWidth - 10, bY + 30);
    const ww = wrapperRef.current?.clientWidth ?? 800;
    let left = pos.left - STEP_POPUP_W + 18;
    if (left < 8) left = 8;
    if (left + STEP_POPUP_W > ww - 8) left = ww - STEP_POPUP_W - 8;
    setStepMenuPos({ left, top: pos.top });
    setActiveStepMenu(i);
  }, [activeStepMenu, vbToPx, viewSteps]);

  // Open drop-off ⋮ menu
  const openDropoffMenu = useCallback((i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeDropoffMenu === i) { setActiveDropoffMenu(null); return; }
    setActiveStepMenu(null);
    const gX    = barXvb(i) + barWidth;
    const nextBY = barYvb(viewSteps[i + 1].rawValue);
    // Anchor to the ⋮ icon in the drop-off zone
    const dotVbX = gX + gapWidth - 10;
    const dotVbY = nextBY + 20;
    const pos = vbToPx(dotVbX, dotVbY);
    // Popup opens to the right; flip left if overflow
    const ww = wrapperRef.current?.clientWidth ?? 800;
    let left = pos.left + 12;
    if (left + DROPOFF_POPUP_W > ww - 8) left = pos.left - DROPOFF_POPUP_W - 12;
    const top = pos.top - 20;
    setDropoffMenuPos({ left, top });
    setActiveDropoffMenu(i);
  }, [activeDropoffMenu, vbToPx, viewSteps]);

  const closeExpandedMenus = () => {
    setExpandedActiveStepMenu(null);
    setExpandedActiveDropoffMenu(null);
  };

  const vbToViewportExpanded = useCallback((vbX: number, vbY: number) => {
    if (!expandedSvgRef.current) return { left: 0, top: 0 };
    const svgRect = expandedSvgRef.current.getBoundingClientRect();
    const scale = svgRect.width / vbWidth;
    return {
      left: svgRect.left + vbX * scale,
      top: svgRect.top + vbY * scale,
    };
  }, [vbWidth]);

  const openExpandedStepMenu = useCallback((i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const expBarW = expandedLayout.barWidth;
    const expGapW = expandedLayout.gapWidth;
    if (expandedActiveStepMenu === i) {
      setExpandedActiveStepMenu(null);
      return;
    }
    setExpandedActiveDropoffMenu(null);
    const expBarX = PAD_X + i * (expBarW + expGapW);
    const expBarH = Math.max((viewStepsAll[i].rawValue / (viewStepsAll[0]?.rawValue || 1)) * CHART_H, MIN_BAR_H);
    const expBarY = PAD_TOP + CHART_H - expBarH;
    const pos = vbToViewportExpanded(expBarX + expBarW - 10, expBarY + 28);
    let left = pos.left - STEP_POPUP_W + 18;
    if (left < 8) left = 8;
    if (left + STEP_POPUP_W > window.innerWidth - 8) left = window.innerWidth - STEP_POPUP_W - 8;
    setExpandedStepMenuPos({ left, top: pos.top });
    setExpandedActiveStepMenu(i);
  }, [expandedActiveStepMenu, expandedLayout.barWidth, expandedLayout.gapWidth, viewStepsAll, vbToViewportExpanded]);

  const openExpandedDropoffMenu = useCallback((i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const expBarW = expandedLayout.barWidth;
    const expGapW = expandedLayout.gapWidth;
    if (expandedActiveDropoffMenu === i) {
      setExpandedActiveDropoffMenu(null);
      return;
    }
    setExpandedActiveStepMenu(null);
    const expBarX = PAD_X + i * (expBarW + expGapW);
    const nextH = Math.max((viewStepsAll[i + 1].rawValue / (viewStepsAll[0]?.rawValue || 1)) * CHART_H, MIN_BAR_H);
    const nextY = PAD_TOP + CHART_H - nextH;
    const expGX = expBarX + expBarW;
    const pos = vbToViewportExpanded(expGX + expGapW - 8, nextY + 18);
    let left = pos.left + 10;
    if (left + DROPOFF_POPUP_W > window.innerWidth - 8) left = pos.left - DROPOFF_POPUP_W - 12;
    setExpandedDropoffMenuPos({ left, top: pos.top - 18 });
    setExpandedActiveDropoffMenu(i);
  }, [expandedActiveDropoffMenu, expandedLayout.barWidth, expandedLayout.gapWidth, viewStepsAll, vbToViewportExpanded]);

  return (
    <div
      ref={wrapperRef}
      className="w-full bg-white rounded-xl border border-[#E5E7EB] px-6 pt-6 pb-4 select-none"
      style={{ position: "relative" }}
      onClick={closeAll}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
            Funnel Visualization
          </p>
          {overallConversionLabel && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
              {overallConversionLabel}
            </p>
          )}
        </div>
        {isExpandable && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              setIsExpanded(true);
            }}
            title="Expand funnel view"
            style={{
              width: 30,
              height: 30,
              border: "none",
              background: "transparent",
              color: "#98A2B3",
              borderRadius: 7,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#667085";
              e.currentTarget.style.background = "#F3F4F6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#98A2B3";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Maximize2 size={17} />
          </button>
        )}
      </div>

      <div
        style={{
          position: "relative",
          height: compact ? "clamp(332px, 40vh, 360px)" : "clamp(350px, 45vh, 400px)",
          minHeight: compact ? "clamp(332px, 40vh, 360px)" : "clamp(350px, 45vh, 400px)",
          maxHeight: compact ? "clamp(332px, 40vh, 360px)" : "clamp(350px, 45vh, 400px)",
          overflow: "hidden",
        }}
      >
        {isAllExcluded && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.96)",
                border: "1px solid #E5E7EB",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: "#374151",
                fontWeight: 500,
              }}
            >
              No users remain after exclusion.
            </div>
          </div>
        )}
        {/* ── SVG ── */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          width="100%"
          height="100%"
          style={{ display: "block", overflow: "visible" }}
          preserveAspectRatio="xMidYMid meet"
          onClick={closeAll}
        >
        <defs>
          <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(-45)">
            <rect width="14" height="14" fill="#F5F6F8" />
            <line x1="0" y1="0" x2="0" y2="14" stroke="#DCDFE6" strokeWidth="4" />
          </pattern>
          {/* Hover-tinted hatch for drop-off zone */}
          <pattern id="diagonalHatchHover" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(-45)">
            <rect width="14" height="14" fill="#EEF0F5" />
            <line x1="0" y1="0" x2="0" y2="14" stroke="#C8CEDC" strokeWidth="4" />
          </pattern>
          <filter id="labelShadowSoft" x="-50%" y="-50%" width="200%" height="220%">
            <feDropShadow dx="0" dy="3.5" stdDeviation="5.5" floodColor="#111827" floodOpacity="0.12" />
          </filter>
          <filter id="labelShadowHover" x="-50%" y="-50%" width="220%" height="240%">
            <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#111827" floodOpacity="0.18" />
          </filter>
        </defs>

        {viewSteps.map((step, i) => {
          const bH  = renderedH(step.rawValue);
          const bX  = barXvb(i);
          const bY  = barYvb(step.rawValue);

          const isBarHovered = hoveredStep === i || activeStepMenu === i;
          const hasNext      = i < viewSteps.length - 1;
          const nextBY       = hasNext ? barYvb(viewSteps[i + 1].rawValue) : 0;
            const gX           = bX + barWidth;

          const trapPoints = hasNext
            ? [`${gX},${bY}`, `${gX + gapWidth},${nextBY}`, `${gX + gapWidth},${baseline}`, `${gX},${baseline}`].join(" ")
            : "";

          const trapCX = gX + gapWidth / 2;
          const stepLabelW = estimateMetricLabelWidth(step.pctFromFirst, step.countLabel);
          const stepLabelH = 36;
          const stepPlacement: "inside" | "above" = bH < 52 ? "above" : "inside";
          const stepLabelX = Math.max(stepLabelW / 2 + 2, Math.min(vbWidth - stepLabelW / 2 - 2, bX + barWidth / 2));
          const stepLabelY = Math.max(2, bY - Math.round(stepLabelH / 2) + (i === 0 ? 6 : 0));

          const dropLabel = dropoffData[i];
          const dropPct = dropLabel?.pct ?? "0%";
          const dropCountLabel = dropLabel?.label ?? "0";
          const dropTop = Math.min(bY, nextBY);
          const dropLabelW = estimateMetricLabelWidth(dropPct, dropCountLabel);
          const dropLabelH = 35;
          let dropLabelX = Math.max(dropLabelW / 2 + 2, Math.min(vbWidth - dropLabelW / 2 - 2, trapCX));
          let dropLabelY = Math.max(PAD_TOP + 2, Math.min(dropTop + 12, nextBY + 12));
          let dropUseConnector = false;
          const stepRect = { left: stepLabelX - stepLabelW / 2, top: stepLabelY, width: stepLabelW, height: stepLabelH };
          const dropRect = { left: dropLabelX - dropLabelW / 2, top: dropLabelY, width: dropLabelW, height: dropLabelH };
          if (rectsOverlap(stepRect, dropRect)) {
            const movedRight = {
              left: Math.min(vbWidth - dropLabelW - 2, dropRect.left + 12),
              top: dropRect.top,
              width: dropRect.width,
              height: dropRect.height,
            };
            if (!rectsOverlap(stepRect, movedRight)) {
              dropLabelX = movedRight.left + dropLabelW / 2;
            } else {
              dropLabelY = Math.min(baseline - dropLabelH - 2, dropRect.top + 10);
              const movedDown = { ...dropRect, top: dropLabelY };
              if (rectsOverlap(stepRect, movedDown)) {
                dropLabelY = Math.max(PAD_TOP + 2, dropTop - dropLabelH - 8);
                dropUseConnector = true;
              }
            }
          }

          const isDropoffHovered = hoveredDropoff === i || activeDropoffMenu === i;

          return (
            <g key={step.id}>
              {/* ── Blue bar ── */}
              <rect
                x={bX} y={bY} width={barWidth} height={bH}
                fill="#4F83F1" rx={3}
                style={{
                  filter: isBarHovered ? "brightness(1.13)" : "none",
                  transition: "x 240ms ease, y 240ms ease, width 240ms ease, height 240ms ease, filter 180ms ease",
                }}
              />

              <FunnelMetricLabelSVG
                x={stepLabelX}
                y={stepLabelY}
                percentText={step.pctFromFirst}
                countText={step.countLabel}
                variant="step"
                placement={stepPlacement}
                maxWidth={Math.min(136, barWidth - 10)}
                shadowId="labelShadowSoft"
                hoverShadowId="labelShadowHover"
              />

              {/* ⋮ glyph on bar */}
              <text x={bX + barWidth - 14} y={bY + 18}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={15} fontWeight={700}
                fill={`rgba(255,255,255,${isBarHovered ? 0.9 : 0.4})`}
                style={{ transition: "fill 0.15s ease" }}
                pointerEvents="none">
                ⋮
              </text>

              {/* ── Drop-off trapezoid zone ── */}
              {hasNext && (
                <g>
                  {/* Filled polygon — switches hatch on hover */}
                  <polygon
                    points={trapPoints}
                    fill={isDropoffHovered ? "url(#diagonalHatchHover)" : "url(#diagonalHatch)"}
                    style={{ transition: "fill 0.15s ease" }}
                    pointerEvents="none"
                  />

                  {hoveredDropoffLabel === i && (
                    <polygon
                      points={trapPoints}
                      fill="transparent"
                      stroke="rgba(79,131,241,0.42)"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      pointerEvents="none"
                    />
                  )}
                  {dropUseConnector && (
                    <line
                      x1={dropLabelX}
                      y1={dropLabelY + dropLabelH}
                      x2={trapCX}
                      y2={Math.max(dropTop + 6, bY + 6)}
                      stroke="rgba(148,163,184,0.7)"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      pointerEvents="none"
                    />
                  )}
                  <FunnelMetricLabelSVG
                    x={dropLabelX}
                    y={dropLabelY}
                    percentText={dropPct}
                    countText={dropCountLabel}
                    variant="dropoff"
                    placement="stripe"
                    maxWidth={Math.min(126, gapWidth - 8)}
                    shadowId="labelShadowSoft"
                    hoverShadowId="labelShadowHover"
                    onHover={(next) => setHoveredDropoffLabel(next ? i : null)}
                  />

                  {/* ⋮ glyph in drop-off zone */}
                  <text
                    x={gX + gapWidth - 10} y={nextBY + 20}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={13} fontWeight={700}
                    fill={isDropoffHovered ? "#8B92A5" : "#C4C9D4"}
                    style={{ transition: "fill 0.15s ease" }}
                    pointerEvents="none"
                  >
                    ⋮
                  </text>

                  {/* Hover capture — transparent polygon over the trapezoid */}
                  <polygon
                    points={trapPoints}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredDropoff(i)}
                    onMouseLeave={() => setHoveredDropoff(null)}
                    onClick={(e) => openDropoffMenu(i, e)}
                  />

                  {/* Larger ⋮ click zone */}
                  <rect
                    x={gX + gapWidth - 26} y={nextBY + 6}
                    width={26} height={26}
                    fill="transparent" rx={4}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredDropoff(i)}
                    onMouseLeave={() => setHoveredDropoff(null)}
                    onClick={(e) => openDropoffMenu(i, e)}
                  />
                </g>
              )}

              {/* Step labels */}
              <text x={bX + barWidth / 2} y={baseline + 22} textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fontWeight={700} fill="#9CA3AF" letterSpacing="1.1" pointerEvents="none">
                {`STEP ${i + 1}`}
              </text>
              <text x={bX + barWidth / 2} y={baseline + 44} textAnchor="middle" dominantBaseline="middle"
                fontSize={13} fontWeight={700} fill="#111827" pointerEvents="none">
                {step.name}
              </text>
              {step.attributeLabel && (
                <text
                  x={bX + barWidth / 2}
                  y={baseline + 62}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={500}
                  fill="#6B7280"
                  pointerEvents="none"
                >
                  {truncateLabel(step.attributeLabel, 26)}
                </text>
              )}

              {/* Invisible hover capture rect — full bar */}
              <rect
                x={bX} y={bY} width={barWidth} height={bH}
                fill="transparent" rx={3} style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={(e) => e.stopPropagation()}
              />

              {/* ⋮ click zone on bar */}
              <rect
                x={bX + barWidth - 28} y={bY + 4} width={26} height={26}
                fill="transparent" rx={4} style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={(e) => openStepMenu(i, e)}
              />
            </g>
          );
        })}
        </svg>
        {isExpandable && !isExpanded && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 56,
              height: "100%",
              background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 72%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      {isExpandable && !isExpanded && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280", textAlign: "right" }}>
          + {hiddenStepCount} more steps
        </div>
      )}

      {/* ── Step ⋮ popup ── */}
      {activeStepMenu !== null && (
        <div
          style={{ position: "absolute", left: stepMenuPos.left, top: stepMenuPos.top, zIndex: 60, width: STEP_POPUP_W }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ background: "white", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.14)", border: "1px solid #EDEDED", padding: "0", overflow: "hidden" }}>
            <StepMenuSummary
              step={viewSteps[activeStepMenu]}
              stepIndex={activeStepMenu}
              baseCount={viewSteps[0]?.rawValue ?? 0}
            />
            <div style={{ height: 1, background: "#F3F4F6" }} />
            <MenuRow icon="eye" label="View Users" />
            <MenuRow icon="tag" label="Tag Users" />
          </div>
        </div>
      )}

      {/* ── Drop-off rich popup ── */}
      {activeDropoffMenu !== null && (
        <div
          style={{ position: "absolute", left: dropoffMenuPos.left, top: dropoffMenuPos.top, zIndex: 60, width: DROPOFF_POPUP_W }}
          onClick={(e) => e.stopPropagation()}
        >
          <DropoffCard data={dropoffData[activeDropoffMenu]} />
        </div>
      )}
      {isExpanded &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              onClick={() => {
                closeExpandedMenus();
                setIsExpanded(false);
              }}
              style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,0.45)" }}
            />
            <div
              onClick={(e) => {
                e.stopPropagation();
                closeExpandedMenus();
              }}
              style={{
                position: "relative",
                width: "92vw",
                maxWidth: 1400,
                height: "84vh",
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 14,
                boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                padding: "18px 20px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Expanded Funnel View</p>
                <button
                  onClick={() => {
                    closeExpandedMenus();
                    setIsExpanded(false);
                  }}
                  style={{
                    width: 30,
                    height: 30,
                    border: "none",
                    borderRadius: 7,
                    background: "transparent",
                    color: "#98A2B3",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={17} />
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto", border: "1px solid #EEF0F4", borderRadius: 10 }}>
                <div style={{ minWidth: vbWidth, height: "100%", padding: "10px 10px 4px" }}>
                  <svg
                    ref={expandedSvgRef}
                    viewBox={`0 0 ${vbWidth} ${vbHeight}`}
                    width={vbWidth}
                    height="100%"
                    style={{ display: "block", overflow: "visible" }}
                    preserveAspectRatio="xMidYMid meet"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeExpandedMenus();
                    }}
                  >
                    <defs>
                      <pattern id="diagonalHatchExpanded" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(-45)">
                        <rect width="14" height="14" fill="#F5F6F8" />
                        <line x1="0" y1="0" x2="0" y2="14" stroke="#DCDFE6" strokeWidth="4" />
                      </pattern>
                      <pattern id="diagonalHatchExpandedHover" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(-45)">
                        <rect width="14" height="14" fill="#EEF0F5" />
                        <line x1="0" y1="0" x2="0" y2="14" stroke="#C8CEDC" strokeWidth="4" />
                      </pattern>
                      <filter id="labelShadowSoftExpanded" x="-50%" y="-50%" width="200%" height="220%">
                        <feDropShadow dx="0" dy="3.5" stdDeviation="5.5" floodColor="#111827" floodOpacity="0.12" />
                      </filter>
                      <filter id="labelShadowHoverExpanded" x="-50%" y="-50%" width="220%" height="240%">
                        <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#111827" floodOpacity="0.18" />
                      </filter>
                    </defs>
                    {viewStepsAll.map((step, i) => {
                      const expBarW = expandedLayout.barWidth;
                      const expGapW = expandedLayout.gapWidth;
                      const expBarX = PAD_X + i * (expBarW + expGapW);
                      const expBarH = Math.max((step.rawValue / (viewStepsAll[0]?.rawValue || 1)) * CHART_H, MIN_BAR_H);
                      const expBarY = PAD_TOP + CHART_H - expBarH;
                      const stepLabelW = estimateMetricLabelWidth(step.pctFromFirst, step.countLabel);
                      const stepLabelH = 36;
                      const stepPlacement: "inside" | "above" = expBarH < 52 ? "above" : "inside";
                      const stepLabelX = Math.max(stepLabelW / 2 + 2, Math.min(vbWidth - stepLabelW / 2 - 2, expBarX + expBarW / 2));
                      const stepLabelY = Math.max(2, expBarY - Math.round(stepLabelH / 2) + (i === 0 ? 6 : 0));
                      const isBarHovered = expandedHoveredStep === i;
                      const hasNext = i < viewStepsAll.length - 1;
                      const nextY = hasNext
                        ? PAD_TOP + CHART_H - Math.max((viewStepsAll[i + 1].rawValue / (viewStepsAll[0]?.rawValue || 1)) * CHART_H, MIN_BAR_H)
                        : 0;
                      const expGX = expBarX + expBarW;
                      const trap = hasNext
                        ? `${expGX},${expBarY} ${expGX + expGapW},${nextY} ${expGX + expGapW},${baseline} ${expGX},${baseline}`
                        : "";
                      const trapCx = expGX + expGapW / 2;
                      const dropLabel = dropoffDataAll[i];
                      const dropPct = dropLabel?.pct ?? "0%";
                      const dropCountLabel = dropLabel?.label ?? "0";
                      const trapTop = Math.min(expBarY, nextY);
                      const dropLabelW = estimateMetricLabelWidth(dropPct, dropCountLabel);
                      const dropLabelH = 35;
                      let dropLabelX = Math.max(dropLabelW / 2 + 2, Math.min(vbWidth - dropLabelW / 2 - 2, trapCx));
                      let dropLabelY = Math.max(PAD_TOP + 2, Math.min(trapTop + 12, nextY + 12));
                      let dropUseConnector = false;
                      const stepRect = { left: stepLabelX - stepLabelW / 2, top: stepLabelY, width: stepLabelW, height: stepLabelH };
                      const dropRect = { left: dropLabelX - dropLabelW / 2, top: dropLabelY, width: dropLabelW, height: dropLabelH };
                      if (rectsOverlap(stepRect, dropRect)) {
                        const movedRight = {
                          left: Math.min(vbWidth - dropLabelW - 2, dropRect.left + 12),
                          top: dropRect.top,
                          width: dropRect.width,
                          height: dropRect.height,
                        };
                        if (!rectsOverlap(stepRect, movedRight)) {
                          dropLabelX = movedRight.left + dropLabelW / 2;
                        } else {
                          dropLabelY = Math.min(baseline - dropLabelH - 2, dropRect.top + 10);
                          const movedDown = { ...dropRect, top: dropLabelY };
                          if (rectsOverlap(stepRect, movedDown)) {
                            dropLabelY = Math.max(PAD_TOP + 2, trapTop - dropLabelH - 8);
                            dropUseConnector = true;
                          }
                        }
                      }
                      const isDropoffHovered = expandedHoveredDropoff === i;

                      return (
                        <g key={step.id}>
                          <rect
                            x={expBarX}
                            y={expBarY}
                            width={expBarW}
                            height={expBarH}
                            fill="#4F83F1"
                            rx={3}
                            style={{
                              transition: "x 240ms ease, y 240ms ease, width 240ms ease, height 240ms ease, filter 180ms ease",
                              filter: isBarHovered ? "brightness(1.12)" : "none",
                            }}
                          />

                          <FunnelMetricLabelSVG
                            x={stepLabelX}
                            y={stepLabelY}
                            percentText={step.pctFromFirst}
                            countText={step.countLabel}
                            variant="step"
                            placement={stepPlacement}
                            maxWidth={Math.min(136, expBarW - 10)}
                            shadowId="labelShadowSoftExpanded"
                            hoverShadowId="labelShadowHoverExpanded"
                          />

                          {hasNext && (
                            <>
                              <polygon
                                points={trap}
                                fill={isDropoffHovered || expandedActiveDropoffMenu === i ? "url(#diagonalHatchExpandedHover)" : "url(#diagonalHatchExpanded)"}
                                style={{ transition: "fill 0.16s ease" }}
                              />
                              {expandedHoveredDropoffLabel === i && (
                                <polygon
                                  points={trap}
                                  fill="transparent"
                                  stroke="rgba(79,131,241,0.42)"
                                  strokeWidth={1}
                                  strokeDasharray="4 3"
                                  pointerEvents="none"
                                />
                              )}
                              {dropUseConnector && (
                                <line
                                  x1={dropLabelX}
                                  y1={dropLabelY + dropLabelH}
                                  x2={trapCx}
                                  y2={Math.max(trapTop + 6, expBarY + 6)}
                                  stroke="rgba(148,163,184,0.7)"
                                  strokeWidth={1}
                                  strokeDasharray="2 2"
                                  pointerEvents="none"
                                />
                              )}
                              <FunnelMetricLabelSVG
                                x={dropLabelX}
                                y={dropLabelY}
                                percentText={dropPct}
                                countText={dropCountLabel}
                                variant="dropoff"
                                placement="stripe"
                                maxWidth={Math.min(126, expGapW - 8)}
                                shadowId="labelShadowSoftExpanded"
                                hoverShadowId="labelShadowHoverExpanded"
                                onHover={(next) => setExpandedHoveredDropoffLabel(next ? i : null)}
                              />
                              <rect
                                x={expGX}
                                y={Math.min(expBarY, nextY)}
                                width={expGapW}
                                height={baseline - Math.min(expBarY, nextY)}
                                fill="transparent"
                                style={{ cursor: "pointer" }}
                                onMouseEnter={() => setExpandedHoveredDropoff(i)}
                                onMouseLeave={() => setExpandedHoveredDropoff(null)}
                                onClick={(e) => openExpandedDropoffMenu(i, e)}
                              />
                              <text
                                x={expGX + expGapW - 10}
                                y={nextY + 18}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={13}
                                fontWeight={700}
                                fill={isDropoffHovered || expandedActiveDropoffMenu === i ? "#8B92A5" : "#C4C9D4"}
                                style={{ transition: "fill 0.15s ease" }}
                                pointerEvents="none"
                              >
                                ⋮
                              </text>
                              <rect
                                x={expGX + expGapW - 24}
                                y={nextY + 4}
                                width={24}
                                height={24}
                                fill="transparent"
                                rx={4}
                                style={{ cursor: "pointer" }}
                                onMouseEnter={() => setExpandedHoveredDropoff(i)}
                                onMouseLeave={() => setExpandedHoveredDropoff(null)}
                                onClick={(e) => openExpandedDropoffMenu(i, e)}
                              />
                            </>
                          )}
                          <text x={expBarX + expBarW / 2} y={baseline + 22} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="#9CA3AF" letterSpacing="1.1">
                            {`STEP ${i + 1}`}
                          </text>
                          <text x={expBarX + expBarW / 2} y={baseline + 44} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill="#111827">
                            {step.name}
                          </text>
                          {step.attributeLabel && (
                            <text x={expBarX + expBarW / 2} y={baseline + 62} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={500} fill="#6B7280">
                              {truncateLabel(step.attributeLabel, 30)}
                            </text>
                          )}
                          <rect
                            x={expBarX}
                            y={expBarY}
                            width={expBarW}
                            height={expBarH}
                            fill="transparent"
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setExpandedHoveredStep(i)}
                            onMouseLeave={() => setExpandedHoveredStep(null)}
                          />
                          <text
                            x={expBarX + expBarW - 14}
                            y={expBarY + 18}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={14}
                            fontWeight={700}
                            fill={`rgba(255,255,255,${isBarHovered || expandedActiveStepMenu === i ? 0.9 : 0.45})`}
                            pointerEvents="none"
                          >
                            ⋮
                          </text>
                          <rect
                            x={expBarX + expBarW - 28}
                            y={expBarY + 4}
                            width={26}
                            height={24}
                            fill="transparent"
                            rx={4}
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setExpandedHoveredStep(i)}
                            onMouseLeave={() => setExpandedHoveredStep(null)}
                            onClick={(e) => openExpandedStepMenu(i, e)}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
              {expandedActiveStepMenu !== null && (
                <div
                  style={{ position: "fixed", left: expandedStepMenuPos.left, top: expandedStepMenuPos.top, zIndex: 1200, width: STEP_POPUP_W }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ background: "white", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.14)", border: "1px solid #EDEDED", padding: "0", overflow: "hidden" }}>
                    <StepMenuSummary
                      step={viewStepsAll[expandedActiveStepMenu]}
                      stepIndex={expandedActiveStepMenu}
                      baseCount={viewStepsAll[0]?.rawValue ?? 0}
                    />
                    <div style={{ height: 1, background: "#F3F4F6" }} />
                    <MenuRow icon="eye" label="View Users" />
                    <MenuRow icon="tag" label="Tag Users" />
                  </div>
                </div>
              )}
              {expandedActiveDropoffMenu !== null && (
                <div
                  style={{ position: "fixed", left: expandedDropoffMenuPos.left, top: expandedDropoffMenuPos.top, zIndex: 1200, width: DROPOFF_POPUP_W }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropoffCard data={dropoffDataAll[expandedActiveDropoffMenu]} />
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function FunnelMetricLabelSVG({
  x,
  y,
  percentText,
  countText,
  variant,
  placement,
  maxWidth,
  onHover,
  shadowId,
  hoverShadowId,
}: {
  x: number;
  y: number;
  percentText: string;
  countText: string;
  variant: "step" | "dropoff";
  placement: "inside" | "above" | "stripe";
  maxWidth?: number;
  onHover?: (state: boolean) => void;
  shadowId: string;
  hoverShadowId: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [size, setSize] = useState({ width: 74, height: 36 });
  const measureRef = useRef<SVGGElement>(null);
  const minWidth = 56;
  const horizontalPadding = 11;
  const verticalPadding = 7;
  const lineGap = 3;
  const percentSize = variant === "step" ? 13 : 12;
  const countSize = variant === "step" ? 11 : 10.8;
  const labelMaxWidth = Math.max(minWidth, maxWidth ?? 136);

  useEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    try {
      const box = node.getBBox();
      const width = Math.max(minWidth, Math.min(labelMaxWidth, Math.ceil(box.width + horizontalPadding * 2)));
      const height = Math.max(34, Math.ceil(box.height + verticalPadding * 2));
      setSize({ width, height });
    } catch {
      // no-op for detached SVG in rare first render
    }
  }, [percentText, countText, variant, labelMaxWidth]);

  const bgFill = variant === "step"
    ? (hovered ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.95)")
    : (hovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.78)");
  const border = variant === "step" ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.05)";
  const countFill = hovered ? "#4B5563" : "#6B7280";

  return (
    <g
      className={`funnel-metric-label funnel-metric-label--${variant} funnel-metric-label--${placement}`}
      transform={`translate(${x} ${y})`}
      onMouseEnter={() => {
        setHovered(true);
        onHover?.(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onHover?.(false);
      }}
      style={{ cursor: "pointer" }}
    >
      <g
        style={{
          transition: "transform 150ms ease, filter 150ms ease, opacity 150ms ease",
          transformOrigin: "center top",
        }}
        transform="translate(0 0) scale(1)"
        filter={`url(#${hovered ? hoverShadowId : shadowId})`}
      >
        <rect
          x={-size.width / 2}
          y={0}
          width={size.width}
          height={size.height}
          rx={10}
          fill={bgFill}
          stroke={border}
        />
        <text
          x={0}
          y={verticalPadding + 1}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={percentSize}
          fontWeight={700}
          fill="#111827"
          pointerEvents="none"
        >
          {percentText}
        </text>
        <text
          x={0}
          y={verticalPadding + percentSize + lineGap}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={countSize}
          fontWeight={600}
          fill={countFill}
          pointerEvents="none"
        >
          {countText}
        </text>
      </g>
      <g ref={measureRef} opacity={0} pointerEvents="none">
        <text x={0} y={verticalPadding + 1} textAnchor="middle" dominantBaseline="hanging" fontSize={percentSize} fontWeight={700}>
          {percentText}
        </text>
        <text x={0} y={verticalPadding + percentSize + lineGap} textAnchor="middle" dominantBaseline="hanging" fontSize={countSize} fontWeight={600}>
          {countText}
        </text>
      </g>
    </g>
  );
}

// ── Drop-off card ─────────────────────────────────────────────────────────────

function DropoffCard({ data }: { data: { from: string; to: string; pct: string; dropCount: string; totalCount: string } }) {
  return (
    <div style={{
      background: "white",
      borderRadius: 12,
      boxShadow: "0 8px 24px rgba(15,23,42,0.11)",
      border: "1px solid #EEF0F4",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 18px 0" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827", lineHeight: 1.25 }}>
          Dropped Off Users
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF", fontWeight: 500, lineHeight: 1.25 }}>
          {data.from} → {data.to}
        </p>
      </div>

      {/* Stats */}
      <div style={{ padding: "12px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1 }}>
            {data.pct}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#9CA3AF" }}>
            dropped off
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#4B5563", fontWeight: 500, lineHeight: 1.3 }}>
          {data.dropCount} / {data.totalCount} users
        </p>
      </div>

      {/* Divider */}
      <div style={{ margin: "12px 0 0", height: 1, background: "#F3F4F6" }} />

      {/* Actions */}
      <div style={{ padding: "4px 0" }}>
        <MenuRow icon="eye" label="View Users" compact />
        <MenuRow icon="tag" label="Tag Users" compact />
      </div>
    </div>
  );
}

function StepMenuSummary({
  step,
  stepIndex,
  baseCount,
}: {
  step: StepViewModel;
  stepIndex: number;
  baseCount: number;
}) {
  const title = "All Users";
  const subtitleBase = step.name || `Step ${stepIndex + 1}`;
  const subtitle = step.attributeLabel
    ? `${subtitleBase} (${truncateLabel(step.attributeLabel, 26)})`
    : subtitleBase;
  const converted = step.pctFromFirst;
  const ratio = `${step.rawValue.toLocaleString("en-US")} / ${Math.max(0, baseCount).toLocaleString("en-US")}`;

  return (
    <div style={{ padding: "14px 16px 12px" }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.25 }}>
        {title}
      </p>
      <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6B7280", fontWeight: 500, lineHeight: 1.25 }}>
        {subtitle}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1 }}>
          {converted}
        </span>
        <span style={{ fontSize: 13, color: "#4B5563", fontWeight: 500 }}>
          converted
        </span>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "#4B5563", fontWeight: 500, lineHeight: 1.3 }}>
        {ratio}
      </p>
    </div>
  );
}

// ── Shared menu row ───────────────────────────────────────────────────────────

function MenuRow({ icon, label, compact = false }: { icon: "eye" | "tag" | "person"; label: string; compact?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: compact ? 10 : 14,
        padding: compact ? "8px 18px" : "11px 24px", cursor: "pointer",
        background: hovered ? "#F9FAFB" : "transparent",
        transition: "background 0.12s ease",
      }}
    >
      <span style={{ color: hovered ? "#4F83F1" : "#9CA3AF", display: "flex", flexShrink: 0, transition: "color 0.12s" }}>
        <MenuIcon name={icon} />
      </span>
      <span style={{ fontSize: compact ? 13 : 14, fontWeight: 500, color: hovered ? "#111827" : "#4B5563", whiteSpace: "nowrap", transition: "color 0.12s" }}>
        {label}
      </span>
    </div>
  );
}

function MenuIcon({ name }: { name: string }) {
  if (name === "eye") return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  if (name === "tag") return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" strokeLinecap="round" strokeWidth={2.5} />
    </svg>
  );
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" strokeLinecap="round" />
      <line x1="22" y1="11" x2="16" y2="11" strokeLinecap="round" />
    </svg>
  );
}
