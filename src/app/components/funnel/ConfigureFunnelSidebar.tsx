import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, MoreVertical } from "lucide-react";
import { createPortal } from "react-dom";
import { AnomalyAlertsDialog, type AnomalyAlertConfig } from "./AnomalyAlertsDialog";
import { StepAttributeChips } from "./StepAttributeChips";
import type { FunnelDateRange, FunnelExclusionConfig, FunnelOrderMode, FunnelStep } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenAudienceFilter: () => void;
  steps: FunnelStep[];
  dateRange: FunnelDateRange;
  conversionWindow: string;
  conversionUnit: string;
  countingMethod: string;
  orderMode: FunnelOrderMode;
  exclusionConfig: FunnelExclusionConfig;
  onStepsChange: (next: FunnelStep[]) => void;
  onGlobalRulesChange: (next: {
    conversionWindow?: string;
    conversionUnit?: string;
    countingMethod?: string;
    orderMode?: FunnelOrderMode;
    exclusionConfig?: FunnelExclusionConfig;
  }) => void;
  onAddFirstStep: () => void;
  onRequestRightPanelRefresh: () => void;
  onOpenDatePicker: (anchorRect?: DOMRect) => void;
  audienceFilterCount: number;
}

const COUNTING_METHODS = ["Unique Users", "Total Events"];
const CONV_UNITS       = ["Seconds", "Minutes", "Hours", "Days", "Weeks", "Months", "Sessions"];
const EVENT_OPTIONS = [
  "Session Start",
  "Product Viewed",
  "Add to Cart",
  "Checkout Started",
  "Purchase Completed",
];
const ORDER_OPTIONS = [
  {
    value: "In this order",
    description: "Other events allowed in between",
  },
  {
    value: "In strict order",
    description: "No other events allowed between steps",
  },
  {
    value: "Any order",
    description: "Steps can occur in any sequence",
  },
] as const;

const FILTER_FIELDS = [
  { value: "Group ID", type: "number" },
  { value: "Country", type: "string" },
  { value: "Platform", type: "string" },
  { value: "Is Subscriber", type: "boolean" },
  { value: "Last Active Date", type: "date" },
] as const;

type AttributeType = "boolean" | "string" | "number" | "date";
type OperatorValue =
  | "equals"
  | "not_equals"
  | "in"
  | "contains"
  | "exists"
  | "not_exists"
  | "lt"
  | "gt"
  | "between";

const OPERATORS_BY_TYPE: Record<AttributeType, Array<{ value: OperatorValue; label: string }>> = {
  boolean: [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not equals" },
    { value: "exists", label: "Exists" },
    { value: "not_exists", label: "Not Exists" },
  ],
  string: [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not equals" },
    { value: "in", label: "In" },
    { value: "contains", label: "Contains" },
    { value: "exists", label: "Exists" },
    { value: "not_exists", label: "Not Exists" },
  ],
  number: [
    { value: "equals", label: "Equals" },
    { value: "lt", label: "Less Than" },
    { value: "gt", label: "Greater Than" },
    { value: "between", label: "Between" },
    { value: "not_equals", label: "Not equals" },
    { value: "exists", label: "Exists" },
    { value: "not_exists", label: "Not Exists" },
  ],
  date: [
    { value: "equals", label: "Equals" },
    { value: "lt", label: "Less Than" },
    { value: "gt", label: "Greater Than" },
    { value: "between", label: "Between" },
    { value: "not_equals", label: "Not equals" },
    { value: "exists", label: "Exists" },
    { value: "not_exists", label: "Not Exists" },
  ],
};
const MAX_ATTRIBUTE_VALUE_LENGTH = 14;

function getFieldType(field: string): AttributeType {
  return (FILTER_FIELDS.find((item) => item.value === field)?.type ?? "string") as AttributeType;
}

function operatorLabel(operator: OperatorValue): string {
  const all = Object.values(OPERATORS_BY_TYPE).flat();
  return all.find((item) => item.value === operator)?.label ?? "Equals";
}

function operatorToken(operator: OperatorValue): string {
  switch (operator) {
    case "equals":
      return "=";
    case "not_equals":
      return "!=";
    case "in":
      return "in";
    case "contains":
      return "contains";
    case "exists":
      return "exists";
    case "not_exists":
      return "not exists";
    case "lt":
      return "<";
    case "gt":
      return ">";
    case "between":
      return "between";
    default:
      return "=";
  }
}

function parseFilterLabel(label: string) {
  const operators = ["not exists", "contains", "between", "!=", "exists", "in", "=", ">", "<"];
  const foundOperator = operators.find((operator) => label.includes(` ${operator} `));
  if (!foundOperator) {
    return { field: "Platform", operator: "equals" as OperatorValue, value: label, valueTo: "" };
  }
  const [left, ...right] = label.split(` ${foundOperator} `);
  const rawValue = right.join(` ${foundOperator} `).trim();
  if (foundOperator === "between") {
    const [start, end] = rawValue.split(" .. ");
    return {
      field: left.trim() || "Platform",
      operator: "between" as OperatorValue,
      value: start?.trim() || "",
      valueTo: end?.trim() || "",
    };
  }
  const operatorMap: Record<string, OperatorValue> = {
    "=": "equals",
    "!=": "not_equals",
    in: "in",
    contains: "contains",
    exists: "exists",
    "not exists": "not_exists",
    ">": "gt",
    "<": "lt",
  };
  return {
    field: left.trim() || "Platform",
    operator: operatorMap[foundOperator] ?? "equals",
    value: rawValue,
    valueTo: "",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoIcon({
  tooltip,
  anchorRef,
}: {
  tooltip: string;
  anchorRef?: React.RefObject<HTMLElement>;
}) {
  const [hovered, setHovered] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    arrowLeft: number;
    placement: "top" | "bottom";
  }>({
    top: 0,
    left: 0,
    arrowLeft: 16,
    placement: "top",
  });

  useLayoutEffect(() => {
    if (!hovered || !triggerRef.current || !tooltipRef.current) return;

    const targetRect = (anchorRef?.current ?? triggerRef.current).getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const panelRect = triggerRef.current
      .closest("[data-config-panel='true']")
      ?.getBoundingClientRect();

    const safeLeft = panelRect?.left ?? 8;
    const safeRight = panelRect?.right ?? window.innerWidth - 8;
    const safeTop = panelRect?.top ?? 8;
    const safeBottom = panelRect?.bottom ?? window.innerHeight - 8;

    const anchorCenterX = targetRect.left + targetRect.width / 2;
    let left = anchorCenterX - tooltipRect.width / 2;
    if (left < safeLeft + 4) left = safeLeft + 4;
    if (left + tooltipRect.width > safeRight - 4) left = safeRight - tooltipRect.width - 4;

    const tooltipGap = 10;
    let placement: "top" | "bottom" = "top";
    let top = targetRect.top - tooltipRect.height - tooltipGap;
    if (top < safeTop + 4) {
      placement = "bottom";
      top = targetRect.bottom + tooltipGap;
      if (top + tooltipRect.height > safeBottom - 4) {
        top = safeBottom - tooltipRect.height - 4;
      }
    }

    const arrowLeft = Math.max(12, Math.min(tooltipRect.width - 12, anchorCenterX - left));
    setPosition({ top, left, arrowLeft, placement });
  }, [hovered]);

  useEffect(() => {
    if (!hovered) return;
    const onScroll = () => {
      setHovered(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [hovered]);

  return (
    <span
      ref={triggerRef}
      style={{ display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={tooltip}
    >
      <svg
        width="14"
        height="14"
        fill="none"
        viewBox="0 0 24 24"
        stroke="#B0B7C3"
        strokeWidth={2}
        style={{ flexShrink: 0, cursor: "help" }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" />
        <circle cx="12" cy="8" r="1" fill="#B0B7C3" stroke="none" />
      </svg>

      {hovered && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            left: position.left,
            top: position.top,
            maxWidth: 240,
            background: "#0E1B34",
            color: "#F8FAFC",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: "10px 12px",
            boxShadow: "0 8px 22px rgba(15,23,42,0.22)",
            zIndex: 620,
            pointerEvents: "none",
          }}
        >
          <svg
            width="16"
            height="10"
            viewBox="0 0 16 10"
            style={{
              position: "absolute",
              left: position.arrowLeft - 8,
              top: position.placement === "top" ? "100%" : -10,
              transform: position.placement === "bottom" ? "rotate(180deg)" : "none",
              overflow: "visible",
            }}
            aria-hidden="true"
          >
            <path
              d="M8 10C7.2 10 6.4 9.64 5.88 9L0.8 2.6C0 1.6 0.72 0 2 0H14C15.28 0 16 1.6 15.2 2.6L10.12 9C9.6 9.64 8.8 10 8 10Z"
              fill="#0E1B34"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          </svg>
          <div
            style={{
              position: "relative",
              zIndex: 1,
              lineHeight: 1.36,
              fontSize: 13,
              fontWeight: 500,
              color: "#F8FAFC",
              whiteSpace: "pre-line",
            }}
          >
            {tooltip}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}

function SectionHeader({ label, showInfo = true, tooltip = "" }: { label: string; showInfo?: boolean; tooltip?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </span>
      {showInfo && <InfoIcon tooltip={tooltip || label} />}
    </div>
  );
}

function FieldLabel({
  text,
  tooltip,
  anchorRef,
}: {
  text: string;
  tooltip: string;
  anchorRef?: React.RefObject<HTMLElement>;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{text}</span>
      <InfoIcon tooltip={tooltip} anchorRef={anchorRef} />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#F0F1F4", margin: "10px 0" }} />;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
        background: checked ? "#4F83F1" : "#D1D5DB",
        position: "relative", cursor: "pointer",
        transition: "background 0.2s ease",
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: "white",
        position: "absolute", top: 2, left: checked ? 22 : 2,
        transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
      }} />
    </div>
  );
}

function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
  renderInPortal = false,
  onOpen,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  renderInPortal?: boolean;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0, width: 0 });
  const menuIdRef = useRef(`styled-select-${Math.random().toString(36).slice(2)}`);

  const computeMenuPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    let left = rect.left;
    if (left + rect.width > window.innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding);
    }
    let top = rect.bottom + 4;
    const expectedMenuHeight = Math.min(options.length * 34 + 8, 220);
    if (top + expectedMenuHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - expectedMenuHeight - 4);
    }
    setMenuPos({ left, top, width: rect.width });
  };

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!open || !renderInPortal) return;
    computeMenuPosition();
    const onReposition = () => computeMenuPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, renderInPortal, options.length]);

  const menu = (
    <div
      ref={menuRef}
      data-styled-select-menu={menuIdRef.current}
      style={{
        position: renderInPortal ? "fixed" : "absolute",
        top: renderInPortal ? menuPos.top : undefined,
        left: renderInPortal ? menuPos.left : 0,
        right: renderInPortal ? undefined : 0,
        width: renderInPortal ? menuPos.width : undefined,
        ...(renderInPortal ? {} : { top: "calc(100% + 4px)" }),
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        boxShadow: "0 8px 20px rgba(17,24,39,0.12)",
        zIndex: renderInPortal ? 720 : 80,
        overflow: "auto",
        maxHeight: 220,
      }}
    >
      {options.map((option) => (
        <button
          type="button"
          key={option}
          onClick={() => {
            onChange(option);
            setOpen(false);
          }}
          style={{
            width: "100%",
            border: "none",
                background: option === value ? "#EEF4FF" : hoveredOption === option ? "#F9FAFB" : "white",
            color: option === value ? "#1E3A8A" : "#374151",
            height: 34,
            padding: "0 10px",
            textAlign: "left",
            fontSize: 12,
            cursor: "pointer",
                transition: "background 0.14s ease",
          }}
              onMouseEnter={() => setHoveredOption(option)}
              onMouseLeave={() => setHoveredOption(null)}
        >
          {option}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next && renderInPortal) {
              requestAnimationFrame(() => computeMenuPosition());
            }
            if (next) onOpen?.();
            return next;
          });
        }}
        style={{
          width: "100%",
          height: 40,
          border: `1px solid ${open ? "#C7D2FE" : "#E5E7EB"}`,
          borderRadius: 8,
          padding: "0 30px 0 10px",
          fontSize: 12,
          color: "#111827",
          background: "white",
          outline: "none",
          cursor: "pointer",
          textAlign: "left",
          boxShadow: open ? "0 0 0 2px rgba(79,131,241,0.12)" : "none",
        }}
      >
        <span style={{ color: value ? "#111827" : "#9CA3AF" }}>{value || placeholder || ""}</span>
        <ChevronDown
          size={13}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            color: "#9CA3AF",
            pointerEvents: "none",
            transition: "transform 0.16s ease",
          }}
        />
      </button>
      {open && (renderInPortal ? createPortal(menu, document.body) : menu)}
    </div>
  );
}

function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder,
  searchable = true,
  renderInPortal = false,
  maxMenuHeight = 300,
  searchPlaceholder = "Search...",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  searchable?: boolean;
  renderInPortal?: boolean;
  maxMenuHeight?: number;
  searchPlaceholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0, width: 0 });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const computeMenuPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    const width = Math.max(180, rect.width);
    let left = rect.left;
    if (left + width > window.innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    }
    const estimatedHeight = Math.min(maxMenuHeight, searchable ? 250 : 220);
    let top = rect.bottom + 6;
    if (top + estimatedHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - estimatedHeight - 6);
    }
    setMenuPos({ left, top, width });
  };

  useEffect(() => {
    if (!open || !renderInPortal) return;
    computeMenuPos();
    const onReposition = () => computeMenuPos();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, renderInPortal, options.length, query, maxMenuHeight]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const selectValue = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            const next = !prev;
            if (next && renderInPortal) requestAnimationFrame(() => computeMenuPos());
            return next;
          });
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (!open && (event.key === "Enter" || event.key === "ArrowDown")) {
            event.preventDefault();
            setOpen(true);
            return;
          }
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((prev) => Math.min(filtered.length - 1, prev + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((prev) => Math.max(0, prev - 1));
          } else if (event.key === "Enter" && filtered[activeIndex]) {
            event.preventDefault();
            selectValue(filtered[activeIndex]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        style={{
          width: "100%",
          height: 38,
          border: `1px solid ${open ? "#C7D2FE" : "#E5E7EB"}`,
          borderRadius: 8,
          padding: "0 32px 0 10px",
          fontSize: 12,
          color: value ? "#111827" : "#9CA3AF",
          background: "white",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.65 : 1,
          transition: "all 150ms ease",
        }}
      >
        {value || placeholder}
        <ChevronDown
          size={13}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            color: "#9CA3AF",
            transition: "transform 150ms ease",
          }}
        />
      </button>
      {open && (renderInPortal ? createPortal(
        <div
          ref={menuRef}
          data-searchable-menu="true"
          style={{
            position: renderInPortal ? "fixed" : "absolute",
            left: renderInPortal ? menuPos.left : 0,
            right: renderInPortal ? undefined : 0,
            top: renderInPortal ? menuPos.top : "calc(100% + 6px)",
            width: renderInPortal ? menuPos.width : undefined,
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
            zIndex: renderInPortal ? 760 : 40,
            padding: 8,
            animation: "step-dd-fade 150ms ease-out",
          }}
        >
          <style>
            {`@keyframes step-dd-fade {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }`}
          </style>
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: "100%",
                height: 34,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "0 10px",
                fontSize: 12,
                color: "#111827",
                outline: "none",
                marginBottom: 8,
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((prev) => Math.min(filtered.length - 1, prev + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((prev) => Math.max(0, prev - 1));
                } else if (event.key === "Enter" && filtered[activeIndex]) {
                  event.preventDefault();
                  selectValue(filtered[activeIndex]);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                }
              }}
            />
          )}
          <div style={{ maxHeight: maxMenuHeight - (searchable ? 56 : 0), overflowY: "auto" }}>
            {filtered.map((option, index) => {
              const selected = option === value;
              const active = index === activeIndex;
              return (
                <button
                  key={option}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectValue(option)}
                  style={{
                    width: "100%",
                    height: 36,
                    border: "none",
                    borderRadius: 8,
                    background: active ? "#F9FAFB" : selected ? "#EEF4FF" : "white",
                    color: selected ? "#1E3A8A" : "#374151",
                    fontSize: 12,
                    textAlign: "left",
                    padding: "0 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{option}</span>
                  {selected && <span style={{ color: "#4F83F1", fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: "8px 10px", fontSize: 12, color: "#9CA3AF" }}>No results</div>
            )}
          </div>
        </div>,
        document.body,
      ) : (
        <div
          ref={menuRef}
          data-searchable-menu="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 6px)",
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
            zIndex: 40,
            padding: 8,
            animation: "step-dd-fade 150ms ease-out",
          }}
        >
          <style>
            {`@keyframes step-dd-fade {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }`}
          </style>
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: "100%",
                height: 34,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "0 10px",
                fontSize: 12,
                color: "#111827",
                outline: "none",
                marginBottom: 8,
              }}
            />
          )}
          <div style={{ maxHeight: maxMenuHeight - (searchable ? 56 : 0), overflowY: "auto" }}>
            {filtered.map((option, index) => {
              const selected = option === value;
              const active = index === activeIndex;
              return (
                <button
                  key={option}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectValue(option)}
                  style={{
                    width: "100%",
                    height: 36,
                    border: "none",
                    borderRadius: 8,
                    background: active ? "#F9FAFB" : selected ? "#EEF4FF" : "white",
                    color: selected ? "#1E3A8A" : "#374151",
                    fontSize: 12,
                    textAlign: "left",
                    padding: "0 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{option}</span>
                  {selected && <span style={{ color: "#4F83F1", fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: "8px 10px", fontSize: 12, color: "#9CA3AF" }}>No results</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepMenuDropdown({ onEdit, onDuplicate, onRemove }: {
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const items = [
    { label: "Edit Event", icon: "✎", action: onEdit,      disabled: false, danger: false },
    { label: "Duplicate Event", icon: "⧉", action: onDuplicate, disabled: false, danger: false },
    null, // divider
    { label: "Remove Event", icon: "✕", action: onRemove, disabled: false, danger: true },
  ];
  return (
    <div
      data-step-menu="true"
      onClick={e => e.stopPropagation()}
      style={{
        background: "white", borderRadius: 10,
        boxShadow: "0 8px 28px rgba(0,0,0,0.13)", border: "1px solid #EBEBEB",
        zIndex: 30, minWidth: 196, overflow: "hidden", padding: "4px 0",
      }}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} style={{ height: 1, background: "#F3F4F6", margin: "3px 0" }} />
        ) : (
          <DropdownItem key={item.label} {...item} />
        )
      )}
    </div>
  );
}

function DropdownItem({ label, icon, action, disabled, danger }: {
  label: string; icon: string; action: () => void; disabled: boolean; danger: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={disabled ? undefined : action}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 16px", cursor: disabled ? "not-allowed" : "pointer",
        background: hov && !disabled ? (danger ? "#FFF5F5" : "#F9FAFB") : "transparent",
        opacity: disabled ? 0.38 : 1, transition: "background 0.12s",
      }}
    >
      <span style={{ fontSize: 13, color: danger ? "#EF4444" : "#6B7280" }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: danger ? "#EF4444" : "#374151" }}>{label}</span>
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export function ConfigureFunnelSidebar({
  open,
  onClose,
  onOpenAudienceFilter,
  steps,
  dateRange,
  conversionWindow,
  conversionUnit,
  countingMethod,
  orderMode,
  exclusionConfig,
  onStepsChange,
  onGlobalRulesChange,
  onAddFirstStep,
  onRequestRightPanelRefresh,
  onOpenDatePicker,
  audienceFilterCount,
}: Props) {
  const [anomalies, setAnomalies] = useState(false);
  const [anomalyAlerts, setAnomalyAlerts] = useState<AnomalyAlertConfig[]>([]);
  const [editingAnomalyId, setEditingAnomalyId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [activeMenu, setActiveMenu]     = useState<number | null>(null);
  const [showOrderDrop, setShowOrderDrop] = useState(false);
  const [orderMenuPos, setOrderMenuPos] = useState({ left: 0, top: 0, width: 0 });
  const orderMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const orderMenuScopeRef = useRef<HTMLDivElement>(null);
  const orderMenuRef = useRef<HTMLDivElement>(null);
  const [draggingStepId, setDraggingStepId] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [stepMenuPos, setStepMenuPos] = useState({ left: 0, top: 0 });
  const [convError, setConvError] = useState("");
  const [convTouched, setConvTouched] = useState(false);
  const [hoveredStepId, setHoveredStepId] = useState<number | null>(null);
  const [builderStepId, setBuilderStepId] = useState<number | null>(null);
  const [editingFilterId, setEditingFilterId] = useState<number | null>(null);
  const [builderField, setBuilderField] = useState<string>(FILTER_FIELDS[0].value);
  const [builderOperator, setBuilderOperator] = useState<OperatorValue>(OPERATORS_BY_TYPE.string[0].value);
  const [builderValue, setBuilderValue] = useState("");
  const [builderValueTo, setBuilderValueTo] = useState("");
  const [builderError, setBuilderError] = useState("");
  const [excludeBuilderOpen, setExcludeBuilderOpen] = useState(false);
  const [excludeEditingFilterId, setExcludeEditingFilterId] = useState<number | null>(null);
  const [excludeBuilderField, setExcludeBuilderField] = useState<string>(FILTER_FIELDS[0].value);
  const [excludeBuilderOperator, setExcludeBuilderOperator] = useState<OperatorValue>(OPERATORS_BY_TYPE.string[0].value);
  const [excludeBuilderValue, setExcludeBuilderValue] = useState("");
  const [excludeBuilderValueTo, setExcludeBuilderValueTo] = useState("");
  const [excludeBuilderError, setExcludeBuilderError] = useState("");
  const [showAllExclusionChips, setShowAllExclusionChips] = useState(false);
  const [eventPickerStepId, setEventPickerStepId] = useState<number | null>(null);
  const [eventPickerQuery, setEventPickerQuery] = useState("");
  const [eventPickerActiveIndex, setEventPickerActiveIndex] = useState(0);
  const [eventPickerPos, setEventPickerPos] = useState({ left: 0, top: 0, width: 0 });
  const eventPickerTriggerRef = useRef<Record<number, HTMLButtonElement | null>>({});
  const eventPickerRef = useRef<HTMLDivElement>(null);

  const nextStepId = useMemo(
    () => (steps.length ? Math.max(...steps.map((step) => step.id)) + 1 : 1),
    [steps],
  );

  // Keep order menu anchored to trigger on scroll/resize with collision handling.
  const computeOrderMenuPosition = (measuredHeight?: number) => {
    if (!orderMenuTriggerRef.current) return;
    const rect = orderMenuTriggerRef.current.getBoundingClientRect();
    const scopeRect = orderMenuScopeRef.current?.getBoundingClientRect();
    const viewportPadding = 8;
    const offset = 8;
    const width = scopeRect ? Math.max(220, scopeRect.width - 2) : rect.width;
    const maxHeight = Math.min(320, window.innerHeight - 160);
    const estimatedRowHeight = 66;
    const contentHeightEstimate = 16 + ORDER_OPTIONS.length * estimatedRowHeight;
    const menuHeight = Math.min(maxHeight, measuredHeight ?? contentHeightEstimate);

    let left = scopeRect ? scopeRect.left + 1 : rect.left;
    if (left + width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - width - viewportPadding;
    }
    if (left < viewportPadding) left = viewportPadding;

    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;

    // Prefer opening below the trigger (as in the expected screenshot),
    // and only flip upward when there truly isn't enough space below.
    let top = rect.bottom + offset;
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      top = rect.top - offset - menuHeight;
    }
    if (top < viewportPadding) top = viewportPadding;

    setOrderMenuPos({ left, top, width });
  };

  useEffect(() => {
    if (!showOrderDrop) return;
    computeOrderMenuPosition();
    requestAnimationFrame(() => {
      if (orderMenuRef.current) computeOrderMenuPosition(orderMenuRef.current.offsetHeight);
    });
    let rafId = 0;
    const requestUpdate = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        computeOrderMenuPosition(orderMenuRef.current?.offsetHeight);
      });
    };
    window.addEventListener("scroll", requestUpdate, true);
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", requestUpdate, true);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [showOrderDrop]);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const insideBuilder = !!target.closest("[data-filter-builder='true']");
      const insideEventPicker = !!target.closest("[data-event-picker='true']");
      const insideSearchableMenu = !!target.closest("[data-searchable-menu='true']");
      if (
        target.closest("[data-step-menu='true']") ||
        target.closest("[data-step-menu-trigger='true']") ||
        target.closest("[data-order-menu='true']") ||
        target.closest("[data-order-menu-trigger='true']")
      ) {
        return;
      }
      if (!insideBuilder && !insideSearchableMenu && builderStepId !== null) {
        applyFilterBuilder();
      }
      if (!insideEventPicker && !target.closest("[data-event-picker-trigger='true']")) {
        setEventPickerStepId(null);
      }
      setActiveMenu(null);
      setShowOrderDrop(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [builderStepId, builderField, builderOperator, builderValue, builderValueTo, editingFilterId, steps]);

  useEffect(() => {
    if (builderStepId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFilterBuilder();
      } else if (event.key === "Enter") {
        applyFilterBuilder();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [builderStepId, builderField, builderOperator, builderValue, builderValueTo, editingFilterId, steps]);

  const computeEventPickerPosition = (stepId: number) => {
    const trigger = eventPickerTriggerRef.current[stepId];
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(220, rect.width);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    let top = rect.bottom + 6;
    const estimatedHeight = 250;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 6);
    }
    setEventPickerPos({ left, top, width });
  };

  const filteredEventOptions = useMemo(() => {
    const q = eventPickerQuery.trim().toLowerCase();
    const all = EVENT_OPTIONS;
    if (!q) return all;
    return all.filter((item) => item.toLowerCase().includes(q));
  }, [eventPickerQuery]);

  useEffect(() => {
    if (eventPickerStepId === null) return;
    computeEventPickerPosition(eventPickerStepId);
    setEventPickerActiveIndex(0);
    const onReposition = () => computeEventPickerPosition(eventPickerStepId);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [eventPickerStepId]);

  useEffect(() => {
    if (eventPickerStepId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setEventPickerActiveIndex((prev) => Math.min(filteredEventOptions.length - 1, prev + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setEventPickerActiveIndex((prev) => Math.max(0, prev - 1));
      } else if (event.key === "Enter" && filteredEventOptions[eventPickerActiveIndex]) {
        event.preventDefault();
        const selected = filteredEventOptions[eventPickerActiveIndex];
        updateStepEvent(eventPickerStepId, selected);
        setEventPickerStepId(null);
        setEventPickerQuery("");
      } else if (event.key === "Escape") {
        event.preventDefault();
        setEventPickerStepId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [eventPickerStepId, filteredEventOptions, eventPickerActiveIndex]);

  useEffect(() => {
    setEventPickerActiveIndex(0);
  }, [eventPickerQuery]);

  const exclusionScopeOptions = useMemo(() => {
    const dynamic = Array.from({ length: Math.max(0, steps.length - 1) }, (_, idx) => `Step ${idx + 1} → ${idx + 2}`);
    return ["All Steps", ...dynamic];
  }, [steps.length]);

  const updateExclusionConfig = (patch: Partial<FunnelExclusionConfig>, refresh = true) => {
    const next = { ...exclusionConfig, ...patch };
    onGlobalRulesChange({ exclusionConfig: next });
    if (refresh) onRequestRightPanelRefresh();
  };

  useEffect(() => {
    if (exclusionScopeOptions.includes(exclusionConfig.scope)) return;
    updateExclusionConfig({ scope: "All Steps" });
  }, [exclusionScopeOptions, exclusionConfig.scope]);

  useEffect(() => {
    if (exclusionConfig.filters.length <= 3) {
      setShowAllExclusionChips(false);
    }
  }, [exclusionConfig.filters.length]);

  useEffect(() => {
    if (!exclusionConfig.enabled) return;
    if (exclusionConfig.eventName && !EVENT_OPTIONS.includes(exclusionConfig.eventName)) {
      updateExclusionConfig({ enabled: false, eventName: "", filters: [], scope: "All Steps" });
      setExcludeBuilderOpen(false);
      setExcludeEditingFilterId(null);
    }
  }, [exclusionConfig.enabled, exclusionConfig.eventName]);

  // ── Step helpers ──
  const requiresValue = !["exists", "not_exists"].includes(builderOperator);
  const requiresTwoValues = builderOperator === "between";

  const composeFilterLabel = (field: string, operator: OperatorValue, value: string, valueTo: string) => {
    if (operator === "exists" || operator === "not_exists") {
      return `${field} ${operatorToken(operator)}`;
    }
    if (operator === "between") {
      return `${field} between ${value} .. ${valueTo}`;
    }
    return `${field} ${operatorToken(operator)} ${value}`;
  };

  const exclusionRequiresValue = !["exists", "not_exists"].includes(excludeBuilderOperator);
  const exclusionRequiresTwoValues = excludeBuilderOperator === "between";

  const openExclusionBuilder = (filterId?: number) => {
    setExcludeBuilderError("");
    setExcludeBuilderOpen(true);
    if (filterId === undefined) {
      setExcludeEditingFilterId(null);
      setExcludeBuilderField(FILTER_FIELDS[0].value);
      setExcludeBuilderOperator(OPERATORS_BY_TYPE[getFieldType(FILTER_FIELDS[0].value)][0].value);
      setExcludeBuilderValue("");
      setExcludeBuilderValueTo("");
      return;
    }
    const filter = exclusionConfig.filters.find((item) => item.id === filterId);
    if (!filter) return;
    const parsed = filter.field && filter.operator && filter.value
      ? {
          field: filter.field,
          operator: filter.operator as OperatorValue,
          value: filter.value,
          valueTo: filter.valueTo ?? "",
        }
      : parseFilterLabel(filter.label);
    const operatorOptions = OPERATORS_BY_TYPE[getFieldType(parsed.field)];
    setExcludeBuilderField(parsed.field);
    setExcludeBuilderOperator(
      operatorOptions.some((item) => item.value === parsed.operator) ? parsed.operator : operatorOptions[0].value,
    );
    setExcludeBuilderValue(parsed.value);
    setExcludeBuilderValueTo(parsed.valueTo ?? "");
    setExcludeEditingFilterId(filter.id);
  };

  const closeExclusionBuilder = () => {
    setExcludeBuilderOpen(false);
    setExcludeEditingFilterId(null);
    setExcludeBuilderError("");
  };

  const applyExclusionBuilder = () => {
    const normalizedValue = excludeBuilderValue.trim();
    const normalizedValueTo = excludeBuilderValueTo.trim();
    if (exclusionRequiresValue && !normalizedValue) {
      setExcludeBuilderError("Value is required.");
      return;
    }
    if (exclusionRequiresTwoValues && !normalizedValueTo) {
      setExcludeBuilderError("Enter a second value.");
      return;
    }
    const label = composeFilterLabel(excludeBuilderField, excludeBuilderOperator, normalizedValue, normalizedValueTo);
    const nextFilters = excludeEditingFilterId === null
      ? [
          ...exclusionConfig.filters,
          {
            id: Date.now(),
            label,
            field: excludeBuilderField,
            operator: excludeBuilderOperator,
            value: normalizedValue,
            valueTo: normalizedValueTo,
            joiner: "AND" as const,
          },
        ]
      : exclusionConfig.filters.map((filter) =>
          filter.id === excludeEditingFilterId
            ? {
                ...filter,
                label,
                field: excludeBuilderField,
                operator: excludeBuilderOperator,
                value: normalizedValue,
                valueTo: normalizedValueTo,
                joiner: "AND" as const,
              }
            : filter,
        );
    updateExclusionConfig({ filters: nextFilters });
    closeExclusionBuilder();
  };

  const removeExclusionFilter = (filterId: number) => {
    updateExclusionConfig({ filters: exclusionConfig.filters.filter((filter) => filter.id !== filterId) });
  };

  const openFilterBuilder = (stepId: number, filterId?: number) => {
    setBuilderStepId(stepId);
    setBuilderError("");
    if (filterId !== undefined) {
      const filter = steps.find((step) => step.id === stepId)?.filters.find((item) => item.id === filterId);
      if (filter) {
        const parsed = filter.field && filter.operator && filter.value
          ? {
              field: filter.field,
              operator: filter.operator as OperatorValue,
              value: filter.value,
              valueTo: filter.valueTo ?? "",
            }
          : parseFilterLabel(filter.label);
        const operatorOptions = OPERATORS_BY_TYPE[getFieldType(parsed.field)];
        setBuilderField(parsed.field);
        setBuilderOperator(
          operatorOptions.some((item) => item.value === parsed.operator)
            ? parsed.operator
            : operatorOptions[0].value,
        );
        setBuilderValue(parsed.value);
        setBuilderValueTo(parsed.valueTo ?? "");
        setEditingFilterId(filter.id);
      }
    } else {
      setBuilderField(FILTER_FIELDS[0].value);
      setBuilderOperator(OPERATORS_BY_TYPE[getFieldType(FILTER_FIELDS[0].value)][0].value);
      setBuilderValue("");
      setBuilderValueTo("");
      setEditingFilterId(null);
    }
  };

  const closeFilterBuilder = (clearError = true) => {
    setBuilderStepId(null);
    setEditingFilterId(null);
    setBuilderValue("");
    setBuilderValueTo("");
    setBuilderField(FILTER_FIELDS[0].value);
    setBuilderOperator(OPERATORS_BY_TYPE[getFieldType(FILTER_FIELDS[0].value)][0].value);
    if (clearError) setBuilderError("");
  };

  const applyFilterBuilder = () => {
    if (builderStepId === null) return;
    const normalizedValue = builderValue.trim();
    const normalizedValueTo = builderValueTo.trim();

    if (requiresValue && !normalizedValue) {
      setBuilderError("Value is required.");
      return;
    }
    if (requiresTwoValues && !normalizedValueTo) {
      setBuilderError("Enter a second value.");
      return;
    }

    setBuilderError("");
    const label = composeFilterLabel(builderField, builderOperator, normalizedValue, normalizedValueTo);
    onStepsChange(
      steps.map((step) => {
        if (step.id !== builderStepId) return step;
        if (editingFilterId !== null) {
          return {
            ...step,
            filters: step.filters.map((filter) =>
              filter.id === editingFilterId
                ? {
                    ...filter,
                    label,
                    field: builderField,
                    operator: builderOperator,
                    value: normalizedValue,
                    valueTo: normalizedValueTo,
                    joiner: "AND",
                  }
                : filter,
            ),
          };
        }
        return {
          ...step,
          filters: [
            ...step.filters,
            {
              id: Date.now(),
              label,
              field: builderField,
              operator: builderOperator,
              value: normalizedValue,
              valueTo: normalizedValueTo,
              joiner: "AND",
            },
          ],
        };
      }),
    );
    onRequestRightPanelRefresh();
    closeFilterBuilder();
  };
  const removeFilter = (stepId: number, filterId: number) => {
    onStepsChange(steps.map(st => st.id === stepId
      ? { ...st, filters: st.filters.filter(f => f.id !== filterId) }
      : st
    ));
    onRequestRightPanelRefresh();
  };
  const addStep = () => {
    if (steps.length >= 10) return;
    onStepsChange([
      ...steps,
      { id: nextStepId, eventName: "", filters: [], showExclude: false, excludeValue: "" },
    ]);
  };
  const deleteStep = (stepId: number) => {
    onStepsChange(steps.filter(st => st.id !== stepId));
    setActiveMenu(null);
  };
  const duplicateStep = (stepId: number) => {
    const source = steps.find((step) => step.id === stepId);
    if (!source) return;
    onStepsChange([
      ...steps,
      {
        ...source,
        id: nextStepId,
        filters: source.filters.map((filter) => ({ ...filter, id: Date.now() + Math.floor(Math.random() * 1000) })),
      },
    ]);
    setActiveMenu(null);
  };
  const updateStepEvent = (stepId: number, eventName: string) => {
    onStepsChange(
      steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              eventName,
              filters: eventName ? step.filters : [],
            }
          : step,
      ),
    );
    if (!eventName) {
      closeFilterBuilder();
    }
    onRequestRightPanelRefresh();
  };
  const handleConversionWindowChange = (value: string) => {
    const sanitized = value.replace(/\D/g, "");
    onGlobalRulesChange({ conversionWindow: sanitized });
    if (sanitized.length === 0) {
      setConvError(convTouched ? "Required." : "");
      return;
    }
    if (Number(sanitized) > 99) {
      setConvError("Max 99 is allowed.");
    } else {
      setConvError("");
      onRequestRightPanelRefresh();
    }
  };
  const handleConversionKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const blocked = ["-", "+", "e", "E", ".", ","];
    if (blocked.includes(event.key)) {
      event.preventDefault();
      return;
    }
    const allowedControlKeys = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Tab",
      "Home",
      "End",
    ];
    if (allowedControlKeys.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  };
  const handleConversionPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    const sanitized = pasted.replace(/\D/g, "");
    onGlobalRulesChange({ conversionWindow: sanitized });
    handleConversionWindowChange(sanitized);
  };
  const handleDrop = (targetIndex: number) => {
    if (draggingStepId === null) return;
    const sourceIndex = steps.findIndex((step) => step.id === draggingStepId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      setDraggingStepId(null);
      setDropIndex(null);
      return;
    }
    const reordered = [...steps];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onStepsChange(reordered);
    setDraggingStepId(null);
    setDropIndex(null);
  };

  return (
    <>
      <div
        data-config-panel="true"
        style={{
          height: "100%",
          width: "100%",
          background: "#FAFAFA",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={() => {
          setActiveMenu(null);
          setShowOrderDrop(false);
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 13px",
            borderBottom: "1px solid #E5E7EB",
            background: "white",
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>Funnel Builder</h2>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* ── MEASUREMENT ── */}
          <Card style={{ order: 3 }}>
            <SectionHeader label="MEASUREMENT" showInfo={false} />

            {/* Counting Method */}
            <FieldLabel text="Counting Method" tooltip={"Determines how conversions are counted:\n• Unique Users: Each user is counted once.\n• Total Events: Multiple events per user are counted."} />
            <StyledSelect
              value={countingMethod}
              onChange={(value) => {
                onGlobalRulesChange({ countingMethod: value });
                onRequestRightPanelRefresh();
              }}
              options={COUNTING_METHODS}
            />

            <Divider />

            {/* Conversion Window */}
            <FieldLabel text="Conversion Window" tooltip="Defines the maximum time allowed between the first and last step for a user to complete the funnel." />
            <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={conversionWindow}
                onChange={e => {
                  handleConversionWindowChange(e.target.value);
                }}
                onKeyDown={handleConversionKeyDown}
                onPaste={handleConversionPaste}
                style={{
                  width: 76, height: 40, border: `1px solid ${convError ? "#EF4444" : "#E5E7EB"}`, borderRadius: 8,
                  padding: "0 12px", fontSize: 14, color: "#111827",
                  background: "white", outline: "none", boxSizing: "border-box", appearance: "textfield",
                }}
                onFocus={e => {
                  setConvTouched(true);
                  e.currentTarget.style.borderColor = convError ? "#EF4444" : "#4F83F1";
                }}
                onBlur={e => {
                  if (!e.currentTarget.value) setConvError("Required.");
                  e.currentTarget.style.borderColor = convError ? "#EF4444" : "#E5E7EB";
                }}
              />
              <div style={{ flex: 1 }}>
                <StyledSelect
                  value={conversionUnit}
                  onChange={(value) => {
                    onGlobalRulesChange({ conversionUnit: value });
                    onRequestRightPanelRefresh();
                  }}
                  options={CONV_UNITS}
                  renderInPortal
                  maxMenuHeight={300}
                />
              </div>
            </div>
            {convError && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#EF4444" }}>
                {convError}
              </p>
            )}

          </Card>

          {/* ── AUDIENCE FILTER ── */}
          <Card style={{ order: 2 }}>
            <SectionHeader label="AUDIENCE" tooltip="Apply segment rules to narrow funnel audience." />
            <ApplyFilterBtn onClick={onOpenAudienceFilter} appliedCount={audienceFilterCount} />
          </Card>

          {/* ── FUNNEL STRUCTURE ── */}
          <Card style={{ order: 1 }}>
            {/* Section title row */}
            <div
              ref={orderMenuScopeRef}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                  Funnel Structure
                </span>
              </div>
              {/* Order dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  ref={orderMenuTriggerRef}
                  onClick={e => {
                    e.stopPropagation();
                    setShowOrderDrop(v => {
                      const next = !v;
                      if (next) requestAnimationFrame(() => computeOrderMenuPosition());
                      return next;
                    });
                  }}
                  data-order-menu-trigger="true"
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, color: "#374151",
                    padding: "4px 8px", borderRadius: 6,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  {orderMode} <ChevronDown size={13} />
                </button>
                {showOrderDrop && createPortal(
                  <div
                    ref={orderMenuRef}
                    data-order-menu="true"
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: "fixed",
                      left: orderMenuPos.left,
                      top: orderMenuPos.top,
                      width: orderMenuPos.width || 220,
                      background: "white",
                      borderRadius: 12,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                      border: "1px solid #EDEDED",
                      zIndex: 650,
                      overflowY: "auto",
                      maxHeight: "min(320px, calc(100vh - 160px))",
                      padding: "0",
                    }}
                  >
                    {ORDER_OPTIONS.map((item, index) => {
                      const selected = item.value === orderMode;
                      return (
                        <div key={item.value}>
                          <button
                            type="button"
                            onClick={() => {
                              onGlobalRulesChange({ orderMode: item.value });
                              onRequestRightPanelRefresh();
                              setShowOrderDrop(false);
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              background: selected ? "#F3F4F6" : "white",
                              padding: "12px 18px",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              flexDirection: "column",
                              gap: 3,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = selected ? "#F3F4F6" : "white"; }}
                          >
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                              {item.value}
                            </span>
                            <span style={{ fontSize: 11, color: "#6B7280" }}>
                              {item.description}
                            </span>
                          </button>
                          {index < ORDER_OPTIONS.length - 1 && (
                            <div style={{ height: 1, background: "#F3F4F6" }} />
                          )}
                        </div>
                      );
                    })}
                  </div>,
                  document.body,
                )}
              </div>
            </div>

            {/* Step list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {steps.length === 0 && (
                <button
                  onClick={onAddFirstStep}
                  style={{
                    height: 44,
                    border: "1.5px solid #93C5FD",
                    background: "#EEF4FF",
                    color: "#4F83F1",
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Plus size={13} />
                  Add Your First Step
                </button>
              )}
              {steps.map((step, i) => {
                const isBuilderOpen = builderStepId === step.id;
                const hasEvent = !!step.eventName;
                const showFilterArea = hasEvent || step.filters.length > 0 || isBuilderOpen;
                return (
                  <div
                    key={step.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropIndex(i);
                    }}
                    onDrop={() => handleDrop(i)}
                  >
                    {dropIndex === i && draggingStepId !== null && (
                      <div
                        style={{
                          border: "1.5px dashed #93C5FD",
                          borderRadius: 10,
                          height: 64,
                          background: "rgba(79,131,241,0.06)",
                          marginBottom: 8,
                        }}
                      />
                    )}
                    {/* ── Step card ── */}
                    <div
                      draggable
                      onDragStart={(event) => {
                        setDraggingStepId(step.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(step.id));
                      }}
                      onDragEnd={() => {
                        setDraggingStepId(null);
                        setDropIndex(null);
                      }}
                      onMouseEnter={() => setHoveredStepId(step.id)}
                      onMouseLeave={() => setHoveredStepId((prev) => (prev === step.id ? null : prev))}
                      style={{
                      background: hoveredStepId === step.id ? "#FCFCFF" : "white",
                      border: `1px solid ${hoveredStepId === step.id ? "#DDE4F5" : "#E9EAED"}`,
                      borderRadius: 10, overflow: "hidden",
                      boxShadow: draggingStepId === step.id ? "0 10px 26px rgba(17,24,39,0.18)" : "none",
                      transform: draggingStepId === step.id ? "scale(1.01)" : "scale(1)",
                      opacity: draggingStepId === step.id ? 0.96 : 1,
                      transition: "all 220ms ease-out",
                    }}>
                      {/* Top content area */}
                      <div style={{ padding: "12px 14px" }}>
                        {/* Row: grip + content + ⋮ */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          {/* Drag handle */}
                          <SixDotHandle />

                          {/* Main content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 30 }}>
                              <button
                                ref={(node) => {
                                  eventPickerTriggerRef.current[step.id] = node;
                                }}
                                type="button"
                                data-event-picker-trigger="true"
                                onClick={() => {
                                  setEventPickerStepId(step.id);
                                  setEventPickerQuery("");
                                  requestAnimationFrame(() => computeEventPickerPosition(step.id));
                                }}
                                style={{
                                  border: "none",
                                  background: "none",
                                  padding: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  minWidth: 0,
                                  cursor: "pointer",
                                }}
                              >
                                <span
                                  style={{
                                    minWidth: 18,
                                    height: 18,
                                    padding: "0 4px",
                                    borderRadius: 5,
                                    background: "#1F2937",
                                    color: "white",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {i + 1}
                                </span>
                                <span
                                  style={{
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: step.eventName ? "#1F2937" : "#9CA3AF",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {step.eventName || "Select event"}
                                </span>
                              </button>
                            </div>
                            {showFilterArea && (
                              <>
                                <div style={{ height: 1, background: "#EEF0F4", margin: "9px 0 10px" }} />
                                {hasEvent && (
                                  <StepAttributeChips
                                    chips={step.filters.map((chip) => ({
                                      id: String(chip.id),
                                      label: chip.label,
                                      onRemove: () => removeFilter(step.id, chip.id),
                                    }))}
                                    onAddAttribute={() => openFilterBuilder(step.id)}
                                  />
                                )}

                                {isBuilderOpen && editingFilterId === null && (
                                  <InlineFilterBuilder
                                    field={builderField}
                                    operator={builderOperator}
                                    value={builderValue}
                                    valueTo={builderValueTo}
                                    error={builderError}
                                    onFieldChange={(nextField) => {
                                      const nextOperators = OPERATORS_BY_TYPE[getFieldType(nextField)];
                                      setBuilderField(nextField);
                                      setBuilderOperator(
                                        nextOperators.some((item) => item.value === builderOperator)
                                          ? builderOperator
                                          : nextOperators[0].value,
                                      );
                                      setBuilderError("");
                                    }}
                                    onOperatorChange={(nextOperator) => {
                                      setBuilderOperator(nextOperator);
                                      setBuilderError("");
                                    }}
                                    onValueChange={(nextValue) => {
                                      setBuilderValue(nextValue);
                                      setBuilderError("");
                                    }}
                                    onValueToChange={(nextValue) => {
                                      setBuilderValueTo(nextValue);
                                      setBuilderError("");
                                    }}
                                    onRemoveRow={() => {
                                      if (editingFilterId !== null) {
                                        removeFilter(step.id, editingFilterId);
                                      }
                                      closeFilterBuilder();
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </div>

                          {/* ⋮ step menu */}
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const menuWidth = 196;
                                const menuHeight = 138;
                                let left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
                                left = Math.max(8, left);
                                let top = rect.bottom + 6;
                                if (top + menuHeight > window.innerHeight - 8) {
                                  top = Math.max(8, rect.top - menuHeight - 6);
                                }
                                setStepMenuPos({ left, top });
                                setActiveMenu(activeMenu === step.id ? null : step.id);
                              }}
                              data-step-menu-trigger="true"
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                padding: "3px 4px", borderRadius: 5, color: "#C4C9D4",
                                display: "flex", alignItems: "center", transition: "all 0.12s",
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = "#F3F4F6";
                                e.currentTarget.style.color = "#6B7280";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = "none";
                                e.currentTarget.style.color = "#C4C9D4";
                              }}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {activeMenu === step.id &&
                              createPortal(
                                <div style={{ position: "fixed", left: stepMenuPos.left, top: stepMenuPos.top, zIndex: 650 }}>
                                  <StepMenuDropdown
                                    onEdit={() => {
                                      setActiveMenu(null);
                                    }}
                                    onDuplicate={() => duplicateStep(step.id)}
                                    onRemove={() => deleteStep(step.id)}
                                  />
                                </div>,
                                document.body,
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {dropIndex === steps.length && draggingStepId !== null && (
                <div
                  style={{
                    border: "1.5px dashed #93C5FD",
                    borderRadius: 10,
                    height: 64,
                    background: "rgba(79,131,241,0.06)",
                  }}
                />
              )}
            </div>

            {/* + Add Another Step */}
            {steps.length > 0 && (
              <AddStepBtn
                onClick={addStep}
                disabled={steps.length >= 10}
                disabledTooltip="You cannot add more than 10 funnel steps."
              />
            )}
          </Card>

          <Card style={{ order: 4 }}>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#6B7280",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                ADVANCED
              </span>
              <ChevronDown
                size={14}
                style={{
                  color: "#9CA3AF",
                  transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }}
              />
            </button>
            {showAdvanced && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Anomaly Detection
                  </span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                      {anomalies ? "Disable anomaly detection" : "Enable anomaly detection"}
                    </span>
                    <Toggle
                      checked={anomalies}
                      onChange={(next) => {
                        if (next) {
                          if (anomalyAlerts.length === 0) {
                            setEditingAnomalyId(null);
                            setShowAnomalyModal(true);
                            return;
                          }
                          setAnomalies(true);
                          return;
                        }
                        setAnomalies(false);
                      }}
                    />
                  </div>
                  {anomalyAlerts.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: anomalies ? 1 : 0.55 }}>
                      {anomalyAlerts.map((alert) => (
                        <div key={alert.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            • {alert.title}
                          </span>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAnomalyId(alert.id);
                                setShowAnomalyModal(true);
                              }}
                              style={{ border: "none", background: "none", color: "#4F83F1", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextAlerts = anomalyAlerts.filter((item) => item.id !== alert.id);
                                setAnomalyAlerts(nextAlerts);
                                if (nextAlerts.length === 0) setAnomalies(false);
                              }}
                              style={{ border: "none", background: "none", color: "#EF4444", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Exclude Users By Event
                  </span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Exclude users by event</span>
                    <Toggle
                      checked={exclusionConfig.enabled}
                      onChange={(next) => {
                        updateExclusionConfig({ enabled: next });
                        if (!next) {
                          setExcludeBuilderOpen(false);
                          setExcludeEditingFilterId(null);
                        }
                      }}
                    />
                  </div>

                  {exclusionConfig.enabled && (
                    <div
                      style={{
                        marginTop: 2,
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        borderRadius: 11,
                        padding: "14px 14px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          Event
                        </span>
                        <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>Exclude users who performed</span>
                        <SearchableDropdown
                          value={exclusionConfig.eventName}
                          onChange={(value) => updateExclusionConfig({ eventName: value })}
                          options={EVENT_OPTIONS}
                          placeholder="Select event"
                          searchable
                          searchPlaceholder="Search events"
                          maxMenuHeight={240}
                        />
                        {!exclusionConfig.eventName && (
                          <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>
                            Select an event to activate exclusion logic.
                          </p>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          Filters
                        </span>
                        {exclusionConfig.filters.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(showAllExclusionChips ? exclusionConfig.filters : exclusionConfig.filters.slice(0, 3)).map((chip) => (
                              <button
                                key={chip.id}
                                type="button"
                                onClick={() => openExclusionBuilder(chip.id)}
                                title={chip.label}
                                style={{
                                  border: "1px solid rgba(79,131,241,0.24)",
                                  background: "rgba(79,131,241,0.08)",
                                  borderRadius: 999,
                                  height: 28,
                                  padding: "0 9px 0 10px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  color: "#3349C8",
                                  cursor: "pointer",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  maxWidth: 186,
                                }}
                              >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chip.label}</span>
                                <span
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeExclusionFilter(chip.id);
                                  }}
                                  style={{ fontSize: 16, lineHeight: 1, color: "#6275D8" }}
                                >
                                  ×
                                </span>
                              </button>
                            ))}
                            {exclusionConfig.filters.length > 3 && (
                              <button
                                type="button"
                                onClick={() => setShowAllExclusionChips((prev) => !prev)}
                                style={{
                                  border: "1px solid #D1D5DB",
                                  background: "white",
                                  borderRadius: 999,
                                  height: 28,
                                  padding: "0 10px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#4B5563",
                                  cursor: "pointer",
                                }}
                              >
                                {showAllExclusionChips ? "Show less" : `+${exclusionConfig.filters.length - 3} more`}
                              </button>
                            )}
                          </div>
                        )}

                        {excludeBuilderOpen && (
                          <InlineFilterBuilder
                            field={excludeBuilderField}
                            operator={excludeBuilderOperator}
                            value={excludeBuilderValue}
                            valueTo={excludeBuilderValueTo}
                            error={excludeBuilderError}
                            onFieldChange={(nextField) => {
                              const nextOperators = OPERATORS_BY_TYPE[getFieldType(nextField)];
                              setExcludeBuilderField(nextField);
                              setExcludeBuilderOperator(
                                nextOperators.some((item) => item.value === excludeBuilderOperator)
                                  ? excludeBuilderOperator
                                  : nextOperators[0].value,
                              );
                              setExcludeBuilderError("");
                            }}
                            onOperatorChange={(nextOperator) => {
                              setExcludeBuilderOperator(nextOperator);
                              setExcludeBuilderError("");
                            }}
                            onValueChange={(nextValue) => {
                              setExcludeBuilderValue(nextValue);
                              setExcludeBuilderError("");
                            }}
                            onValueToChange={(nextValue) => {
                              setExcludeBuilderValueTo(nextValue);
                              setExcludeBuilderError("");
                            }}
                            onRemoveRow={() => {
                              if (excludeEditingFilterId !== null) removeExclusionFilter(excludeEditingFilterId);
                              closeExclusionBuilder();
                            }}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => (excludeBuilderOpen ? applyExclusionBuilder() : openExclusionBuilder())}
                          style={{
                            border: "none",
                            background: "none",
                            color: "#4F83F1",
                            fontSize: 13,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            padding: 0,
                            alignSelf: "flex-start",
                          }}
                        >
                          <Plus size={13} />
                          Add event attribute
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          Scope
                        </span>
                        <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>Apply exclusion to</span>
                        <SearchableDropdown
                          value={exclusionConfig.scope}
                          onChange={(value) => updateExclusionConfig({ scope: value })}
                          options={exclusionScopeOptions}
                          placeholder="All Steps"
                          searchable={false}
                          maxMenuHeight={220}
                          disabled={steps.length < 2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {eventPickerStepId !== null &&
        createPortal(
          <div
            ref={eventPickerRef}
            data-event-picker="true"
            style={{
              position: "fixed",
              left: eventPickerPos.left,
              top: eventPickerPos.top,
              width: eventPickerPos.width,
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
              zIndex: 760,
              padding: 8,
              maxHeight: 270,
              overflow: "hidden",
            }}
          >
            <input
              autoFocus
              value={eventPickerQuery}
              onChange={(event) => setEventPickerQuery(event.target.value)}
              placeholder="Search events"
              style={{
                width: "100%",
                height: 34,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "0 10px",
                fontSize: 12,
                color: "#111827",
                outline: "none",
                marginBottom: 8,
              }}
            />
            <div style={{ maxHeight: 210, overflowY: "auto" }}>
              {filteredEventOptions.map((option, index) => {
                const selected = option === steps.find((step) => step.id === eventPickerStepId)?.eventName;
                const active = index === eventPickerActiveIndex;
                return (
                  <button
                    key={option}
                    type="button"
                    onMouseEnter={() => setEventPickerActiveIndex(index)}
                    onClick={() => {
                      updateStepEvent(eventPickerStepId, option);
                      setEventPickerStepId(null);
                      setEventPickerQuery("");
                    }}
                    style={{
                      width: "100%",
                      height: 36,
                      border: "none",
                      borderRadius: 8,
                      background: active ? "#F9FAFB" : selected ? "#EEF4FF" : "white",
                      color: selected ? "#1E3A8A" : "#374151",
                      padding: "0 10px",
                      fontSize: 12,
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{option}</span>
                    {selected && <span style={{ color: "#4F83F1", fontWeight: 700 }}>✓</span>}
                  </button>
                );
              })}
              {filteredEventOptions.length === 0 && (
                <div style={{ padding: "8px 10px", fontSize: 12, color: "#9CA3AF" }}>No events found</div>
              )}
            </div>
          </div>,
          document.body,
        )}

      <AnomalyAlertsDialog
        open={showAnomalyModal}
        onClose={() => {
          setShowAnomalyModal(false);
          setEditingAnomalyId(null);
        }}
        onSave={(alert) => {
          setAnomalyAlerts([alert]);
          setShowAnomalyModal(false);
          setEditingAnomalyId(null);
          setAnomalies(true);
        }}
        initialAlert={editingAnomalyId ? anomalyAlerts.find((item) => item.id === editingAnomalyId) ?? null : null}
        steps={steps.map((step, index) => ({
          id: step.id,
          name: step.eventName || `Step ${index + 1}`,
        }))}
      />

    </>
  );
}

// ── Small reusable pieces ─────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "transparent",
      borderRadius: 0,
      border: "none",
      padding: 0,
      ...style,
    }}>
      {children}
    </div>
  );
}

function HoverBtn({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "none", border: "none", cursor: "pointer",
        padding: 6, borderRadius: 6, color: "#9CA3AF",
        display: "flex", alignItems: "center", transition: "all 0.12s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = "#374151"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#9CA3AF"; }}
    >
      {children}
    </button>
  );
}

function InlineFilterBuilder({
  field,
  operator,
  value,
  valueTo,
  error,
  onFieldChange,
  onOperatorChange,
  onValueChange,
  onValueToChange,
  onRemoveRow,
}: {
  field: string;
  operator: OperatorValue;
  value: string;
  valueTo: string;
  error: string;
  onFieldChange: (value: string) => void;
  onOperatorChange: (value: OperatorValue) => void;
  onValueChange: (value: string) => void;
  onValueToChange: (value: string) => void;
  onRemoveRow: () => void;
}) {
  const fieldType = getFieldType(field);
  const operators = OPERATORS_BY_TYPE[fieldType];
  const isExistsOperator = operator === "exists" || operator === "not_exists";
  const isBetweenOperator = operator === "between";
  return (
    <div
      data-filter-builder="true"
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: "14px 14px 12px",
        background: "white",
        marginBottom: 8,
        position: "relative",
        animation: "builder-fade-in 170ms ease-out",
      }}
    >
      <style>
        {`@keyframes builder-fade-in {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }`}
      </style>
      <button
        type="button"
        onClick={onRemoveRow}
        title="Remove attribute"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 20,
          height: 20,
          border: "none",
          borderRadius: 999,
          background: "transparent",
          color: "#9CA3AF",
          fontSize: 14,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = "#F3F4F6";
          event.currentTarget.style.color = "#EF4444";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = "transparent";
          event.currentTarget.style.color = "#9CA3AF";
        }}
      >
        ×
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", paddingRight: 24 }}>
        <div style={{ flex: "1 1 120px", minWidth: 120 }}>
          <SearchableDropdown
            value={field}
            onChange={onFieldChange}
            options={FILTER_FIELDS.map((item) => item.value)}
            placeholder="Attribute"
            renderInPortal
            maxMenuHeight={300}
          />
        </div>
        <div style={{ flex: "1 1 120px", minWidth: 120 }}>
          <SearchableDropdown
            value={operatorLabel(operator)}
            onChange={(nextLabel) => {
              const selected = operators.find((item) => item.label === nextLabel)?.value;
              if (selected) onOperatorChange(selected);
            }}
            options={operators.map((item) => item.label)}
            placeholder="Operator"
            searchable={false}
            renderInPortal
            maxMenuHeight={300}
          />
        </div>
        <div style={{ flex: "2 1 160px", display: "flex", gap: 6, minWidth: 120 }}>
          {!isExistsOperator && (
            <BuilderValueInput
              fieldType={fieldType}
              value={value}
              onChange={onValueChange}
              placeholder="Value"
            />
          )}
          {isBetweenOperator && (
            <BuilderValueInput
              fieldType={fieldType}
              value={valueTo}
              onChange={onValueToChange}
              placeholder="And"
            />
          )}
        </div>
      </div>
      {error && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#D97706" }}>{error}</p>
      )}
    </div>
  );
}

function BuilderValueInput({
  fieldType,
  value,
  onChange,
  placeholder,
}: {
  fieldType: AttributeType;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  if (fieldType === "boolean") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          height: 38,
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          padding: "0 10px",
          fontSize: 12,
          color: "#111827",
          background: "white",
          outline: "none",
        }}
      >
        <option value="">Select</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  }

  return (
    <input
      type={fieldType === "date" ? "date" : fieldType === "number" ? "number" : "text"}
      inputMode={fieldType === "number" ? "numeric" : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value.slice(0, MAX_ATTRIBUTE_VALUE_LENGTH))}
      maxLength={fieldType === "number" ? undefined : MAX_ATTRIBUTE_VALUE_LENGTH}
      placeholder={placeholder}
      style={{
        width: "100%",
        height: 38,
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: "0 10px",
        fontSize: 12,
        color: "#111827",
        background: "white",
        outline: "none",
      }}
    />
  );
}

function FilterChipTag({
  label,
  onRemove,
  onEdit,
}: {
  label: string;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const shouldTruncate = label.length > 24;
  const visibleLabel = shouldTruncate ? `${label.slice(0, 24)}…` : label;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "#EEF2FF", border: "1px solid #C7D2FE",
      borderRadius: 20, padding: "3px 10px 3px 12px",
      fontSize: 12, fontWeight: 500, color: "#4338CA",
      animation: "chip-fade-slide 150ms ease-out",
      transition: "all 0.14s ease",
      boxShadow: hovered ? "0 2px 8px rgba(30,58,138,0.14)" : "none",
      transform: hovered ? "translateY(-1px)" : "translateY(0)",
    }}>
      <style>
        {`@keyframes chip-fade-slide {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }`}
      </style>
      <button
        type="button"
        title={label}
        onClick={onEdit}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          border: "none",
          background: "none",
          padding: 0,
          fontSize: 12,
          color: hovered ? "#3730A3" : "#4338CA",
          cursor: "pointer",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 180,
        }}
      >
        {visibleLabel}
      </button>
      <button
        onClick={onRemove}
        onMouseEnter={(event) => {
          setHovered(true);
          event.currentTarget.style.color = "#4F46E5";
        }}
        onMouseLeave={(event) => {
          setHovered(false);
          event.currentTarget.style.color = "#818CF8";
        }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          padding: 0, color: "#818CF8", fontSize: 16, lineHeight: 1,
          display: "flex", alignItems: "center",
        }}
      >
        ×
      </button>
    </div>
  );
}

function ApplyFilterBtn({ onClick, appliedCount }: { onClick: () => void; appliedCount: number }) {
  const emphasized = appliedCount > 0;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", height: 34,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: emphasized ? "#E0ECFF" : "#EEF4FF",
        border: emphasized ? "1.5px solid #60A5FA" : "1.5px solid #93C5FD",
        borderRadius: 7, cursor: "pointer",
        fontSize: 12, fontWeight: 600, color: "#4F83F1",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#DBEAFE"; e.currentTarget.style.borderColor = "#60A5FA"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#EEF4FF"; e.currentTarget.style.borderColor = "#93C5FD"; }}
    >
      {appliedCount > 0 ? (
        `(${appliedCount}) Filters applied`
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Plus size={13} /> Apply Filter
        </span>
      )}
    </button>
  );
}

function SixDotHandle() {
  return (
    <div
      style={{
        width: 14,
        display: "grid",
        gridTemplateColumns: "repeat(2, 4px)",
        gap: 2,
        marginTop: 4,
        flexShrink: 0,
        cursor: "grab",
      }}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <span
          key={index}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#D1D5DB",
            display: "block",
          }}
        />
      ))}
    </div>
  );
}

function AddStepBtn({
  onClick,
  disabled = false,
  disabledTooltip,
}: {
  onClick: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const openTooltip = () => {
    if (!disabled || !btnRef.current || !disabledTooltip) return;
    const rect = btnRef.current.getBoundingClientRect();
    setTooltipPos({ left: rect.left + rect.width / 2, top: rect.top - 10 });
    setTooltipOpen(true);
  };

  const closeTooltip = () => setTooltipOpen(false);

  return (
    <>
      <button
        ref={btnRef}
        onClick={onClick}
        disabled={disabled}
        style={{
          width: "100%", marginTop: 8, padding: "8px",
          border: `1.5px dashed ${disabled ? "#D1D5DB" : "#93C5FD"}`, borderRadius: 8,
          background: disabled ? "#F3F4F6" : "#EEF4FF", color: disabled ? "#9CA3AF" : "#4F83F1",
          fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          openTooltip();
          if (disabled) return;
          e.currentTarget.style.borderColor = "#60A5FA";
          e.currentTarget.style.background = "#E0ECFF";
        }}
        onMouseLeave={e => {
          closeTooltip();
          if (disabled) return;
          e.currentTarget.style.borderColor = "#93C5FD";
          e.currentTarget.style.color = "#4F83F1";
          e.currentTarget.style.background = "#EEF4FF";
        }}
      >
        <Plus size={13} /> Add Another Step
      </button>
      {tooltipOpen &&
        disabledTooltip &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: tooltipPos.left,
              top: tooltipPos.top,
              transform: "translate(-50%, -100%)",
              background: "rgba(17,24,39,0.82)",
              color: "white",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 12px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
              zIndex: 900,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {disabledTooltip}
          </div>,
          document.body,
        )}
    </>
  );
}

function FooterBtn({ label, variant, onClick }: { label: string; variant: "ghost" | "primary"; onClick: () => void }) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      style={{
        flex: isPrimary ? 2 : 1, height: 34, border: "none",
        borderRadius: 8, cursor: "pointer",
        fontSize: 12, fontWeight: isPrimary ? 700 : 600,
        background: isPrimary ? "#4F83F1" : "white",
        color: isPrimary ? "white" : "#6B7280",
        boxShadow: isPrimary ? "none" : "inset 0 0 0 1.5px #E5E7EB",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = isPrimary ? "#3B6FD4" : "#F9FAFB";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isPrimary ? "#4F83F1" : "white";
      }}
    >
      {label}
    </button>
  );
}