import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "../ui/calendar";
import type { DateRange } from "react-day-picker";
import type { FunnelDateRange } from "./types";

type PresetKey = "today" | "yesterday" | "7d" | "30d";

interface DateRangePickerProps {
  onRangeApply?: (range: FunnelDateRange) => void;
}

export interface DateRangePickerHandle {
  open: (anchorRect?: DOMRect) => void;
}

const PRESETS: { label: string; key: PresetKey }[] = [
  { label: "Today", key: "today" },
  { label: "Yesterday", key: "yesterday" },
  { label: "7D", key: "7d" },
  { label: "30D", key: "30d" },
];

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function toInternalRange(range?: DateRange): FunnelDateRange {
  return {
    start: range?.from ?? null,
    end: range?.to ?? null,
  };
}

function getPresetRange(key: PresetKey): DateRange {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);

  if (key === "today") {
    return { from: end, to: end };
  }
  if (key === "yesterday") {
    start.setDate(start.getDate() - 1);
    return { from: start, to: start };
  }
  if (key === "7d") {
    start.setDate(start.getDate() - 6);
    return { from: start, to: end };
  }
  start.setDate(start.getDate() - 29);
  return { from: start, to: end };
}

export const DateRangePicker = forwardRef<DateRangePickerHandle, DateRangePickerProps>(function DateRangePicker(
  { onRangeApply },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey | null>("yesterday");
  const [range, setRange] = useState<DateRange | undefined>(getPresetRange("yesterday"));
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [popoverPos, setPopoverPos] = useState({ left: 0, top: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const openPopover = (externalRect?: DOMRect) => {
    const rect = externalRect ?? anchorRef.current?.getBoundingClientRect();
    if (!rect) {
      setOpen(true);
      return;
    }
    const popoverWidth = 680;
    const gutter = 8;
    // Default left-opening behavior: align popover's right edge with trigger.
    let left = rect.right - popoverWidth;
    if (left < gutter) left = gutter;
    if (left + popoverWidth > window.innerWidth - gutter) {
      left = Math.max(gutter, rect.left);
    }
    const top = Math.min(rect.bottom + 6, window.innerHeight - gutter - 390);
    setPopoverPos({ left, top });
    setOpen(true);
  };

  useImperativeHandle(ref, () => ({
    open: (anchorRect?: DOMRect) => openPopover(anchorRect),
  }), []);

  useEffect(() => {
    if (range?.from && range?.to) {
      onRangeApply?.(toInternalRange(range));
    }
  }, []);

  const previewRange = useMemo(() => {
    if (!range?.from || range?.to || !hoveredDate) return null;
    return hoveredDate >= range.from
      ? { from: range.from, to: hoveredDate }
      : { from: hoveredDate, to: range.from };
  }, [range, hoveredDate]);

  useEffect(() => {
    const clickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        anchorRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setHoveredDate(null);
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const handleSelect = (nextRange: DateRange | undefined) => {
    setRange(nextRange);
    setActivePreset(null);
    if (nextRange?.from && nextRange?.to) {
      onRangeApply?.(toInternalRange(nextRange));
      setOpen(false);
      setHoveredDate(null);
    }
  };

  const handlePresetClick = (key: PresetKey) => {
    const next = getPresetRange(key);
    setActivePreset(key);
    setRange(next);
    onRangeApply?.(toInternalRange(next));
    setOpen(false);
    setHoveredDate(null);
  };

  const rangeLabel =
    range?.from && range?.to
      ? `${formatDisplayDate(range.from)} – ${formatDisplayDate(range.to)}`
      : "Select date range";

  return (
    <div ref={anchorRef} style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
      <button
        onClick={() => (open ? setOpen(false) : openPopover())}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 30,
          minWidth: 250,
          border: `1.5px solid ${open ? "#4F83F1" : "#C7D2FE"}`,
          borderRadius: 7,
          background: "white",
          color: range?.from && range?.to ? "#111827" : "#9CA3AF",
          cursor: "pointer",
          fontSize: 12,
          padding: "0 10px",
          whiteSpace: "nowrap",
        }}
      >
        <CalendarIcon size={14} style={{ color: "#6B7280", flexShrink: 0 }} />
        <span>{rangeLabel}</span>
      </button>

      {PRESETS.map((preset) => {
        const isActive = activePreset === preset.key;
        return (
          <button
            key={preset.key}
            onClick={() => handlePresetClick(preset.key)}
            style={{
              border: "none",
              borderRadius: isActive ? 5 : 0,
              background: isActive ? "#4F83F1" : "transparent",
              color: isActive ? "white" : "#6B7280",
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              padding: isActive ? "3px 8px" : "3px 2px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {preset.label}
          </button>
        );
      })}

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: popoverPos.top,
            left: popoverPos.left,
            zIndex: 9000,
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
            padding: 12,
          }}
        >
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={handleSelect}
            onDayMouseEnter={(date) => setHoveredDate(date)}
            defaultMonth={range?.from ?? new Date()}
            modifiers={{
              preview: (date) =>
                !!previewRange &&
                !!previewRange.from &&
                !!previewRange.to &&
                date >= previewRange.from &&
                date <= previewRange.to,
            }}
            modifiersStyles={{
              selected: { backgroundColor: "#4F83F1", color: "white" },
              range_start: { backgroundColor: "#4F83F1", color: "white" },
              range_end: { backgroundColor: "#4F83F1", color: "white" },
              range_middle: { backgroundColor: "#DBEAFE", color: "#1F2937" },
              preview: { backgroundColor: "#DBEAFE", color: "#1F2937" },
            }}
          />
        </div>
      )}
    </div>
  );
});
