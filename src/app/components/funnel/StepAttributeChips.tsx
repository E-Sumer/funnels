import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Plus, X } from "lucide-react";
import { createPortal } from "react-dom";

interface ChipItem {
  id: string;
  label: string;
  onRemove: () => void;
}

interface StepAttributeChipsProps {
  chips: ChipItem[];
  onAddAttribute: () => void;
  maxRows?: number;
  moreLabel?: (n: number) => string;
}

const CHIP_GAP = 8;
const ROW_GAP = 8;
const CHIP_HEIGHT = 28;

function defaultMoreLabel(n: number) {
  return `+${n} more`;
}

function chipBaseStyle(stronger = false): CSSProperties {
  return {
    height: CHIP_HEIGHT,
    borderRadius: 999,
    border: `1px solid ${stronger ? "#BFDBFE" : "#E5E7EB"}`,
    background: stronger ? "#EAF2FF" : "#F8FAFC",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "0 10px",
    fontSize: 12,
    color: stronger ? "#1E3A8A" : "#374151",
    maxWidth: "100%",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  };
}

function measureFitCount(widths: number[], containerWidth: number, maxRows: number) {
  if (!containerWidth || widths.length === 0) return 0;
  let row = 1;
  let used = 0;
  let count = 0;
  for (const width of widths) {
    const next = used === 0 ? width : used + CHIP_GAP + width;
    if (next <= containerWidth) {
      used = next;
      count += 1;
      continue;
    }
    row += 1;
    if (row > maxRows) break;
    used = width;
    count += 1;
  }
  return count;
}

function canFitWithMore(
  chipWidths: number[],
  visibleCount: number,
  moreWidth: number,
  containerWidth: number,
  maxRows: number,
) {
  const widths = [...chipWidths.slice(0, visibleCount), moreWidth];
  return measureFitCount(widths, containerWidth, maxRows) === widths.length;
}

export function StepAttributeChips({
  chips,
  onAddAttribute,
  maxRows = 2,
  moreLabel = defaultMoreLabel,
}: StepAttributeChipsProps) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(chips.length);
  const [containerWidth, setContainerWidth] = useState(0);
  const [chipWidths, setChipWidths] = useState<number[]>([]);
  const [moreWidths, setMoreWidths] = useState<Record<number, number>>({});
  const [popoverPos, setPopoverPos] = useState({ left: 0, top: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useMemo(() => `step-attr-overflow-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!measureRef.current) return;
    const nodes = Array.from(measureRef.current.querySelectorAll<HTMLElement>("[data-chip-measure]"));
    const measured = nodes.map((node) => Math.ceil(node.getBoundingClientRect().width));
    setChipWidths(measured);
  }, [chips]);

  useEffect(() => {
    if (!measureRef.current) return;
    const moreMap: Record<number, number> = {};
    for (let hidden = 1; hidden <= chips.length; hidden += 1) {
      const node = measureRef.current.querySelector<HTMLElement>(`[data-more-measure="${hidden}"]`);
      if (node) moreMap[hidden] = Math.ceil(node.getBoundingClientRect().width);
    }
    setMoreWidths(moreMap);
  }, [chips, moreLabel]);

  useEffect(() => {
    const fit = measureFitCount(chipWidths, containerWidth, maxRows);
    if (fit >= chips.length) {
      setVisibleCount(chips.length);
      return;
    }
    let nextVisible = fit;
    while (nextVisible > 0) {
      const hidden = chips.length - nextVisible;
      const moreWidth = moreWidths[hidden];
      if (!moreWidth) break;
      if (canFitWithMore(chipWidths, nextVisible, moreWidth, containerWidth, maxRows)) break;
      nextVisible -= 1;
    }
    setVisibleCount(Math.max(0, nextVisible));
  }, [chipWidths, containerWidth, chips.length, maxRows, moreWidths]);

  const hiddenCount = Math.max(0, chips.length - visibleCount);
  const visibleChips = chips.slice(0, visibleCount);
  const hiddenChips = chips.slice(visibleCount);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreBtnRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const togglePopover = () => {
    if (!moreBtnRef.current) return;
    const rect = moreBtnRef.current.getBoundingClientRect();
    const width = 260;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = rect.bottom + 6;
    setPopoverPos({ left, top });
    setOpen((prev) => !prev);
  };

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: CHIP_GAP,
          rowGap: ROW_GAP,
          alignItems: "center",
        }}
      >
        {visibleChips.map((chip) => (
          <div key={chip.id} style={chipBaseStyle()}>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 180,
              }}
              title={chip.label}
            >
              {chip.label}
            </span>
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove ${chip.label}`}
              style={{
                border: "none",
                background: "none",
                color: "#9CA3AF",
                cursor: "pointer",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {hiddenCount > 0 && (
          <button
            ref={moreBtnRef}
            type="button"
            onClick={togglePopover}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                togglePopover();
              }
            }}
            aria-expanded={open}
            aria-controls={popoverId}
            style={{
              ...chipBaseStyle(true),
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {moreLabel(hiddenCount)}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onAddAttribute}
        style={{
          marginTop: 11,
          border: "none",
          background: "none",
          color: "#4F83F1",
          fontSize: 12,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Plus size={13} />
        Add event attribute
      </button>

      <div
        ref={measureRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
          left: -99999,
          top: -99999,
          height: 0,
          overflow: "hidden",
        }}
      >
        {chips.map((chip) => (
          <div key={`m-${chip.id}`} data-chip-measure style={chipBaseStyle()}>
            <span style={{ maxWidth: 180 }}>{chip.label}</span>
            <span style={{ width: 12, height: 12 }} />
          </div>
        ))}
        {chips.map((_, idx) => {
          const hidden = idx + 1;
          return (
            <div key={`more-${hidden}`} data-more-measure={hidden} style={chipBaseStyle(true)}>
              {moreLabel(hidden)}
            </div>
          );
        })}
      </div>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            style={{
              position: "fixed",
              left: popoverPos.left,
              top: popoverPos.top,
              width: 260,
              maxHeight: 220,
              overflowY: "auto",
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              background: "white",
              boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
              zIndex: 980,
              padding: 8,
            }}
          >
            {hiddenChips.map((chip) => (
              <div
                key={`hidden-${chip.id}`}
                style={{
                  height: 34,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "0 10px",
                  border: "1px solid #EEF0F4",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "#374151",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={chip.label}
                >
                  {chip.label}
                </span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Remove ${chip.label}`}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#9CA3AF",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

