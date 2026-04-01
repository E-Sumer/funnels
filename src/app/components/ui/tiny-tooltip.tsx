"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Dark bubble tooltip (portal) matching the info-icon tooltips in funnel modals:
 * #0E1B34 background, light text, arrow, shadow.
 */
export function TinyTooltip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
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
    if (!open || !triggerRef.current || !tooltipRef.current) return;
    const targetRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const safeLeft = 8;
    const safeRight = window.innerWidth - 8;
    const safeTop = 8;
    const safeBottom = window.innerHeight - 8;

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
      if (top + tooltipRect.height > safeBottom - 4) top = safeBottom - tooltipRect.height - 4;
    }

    const arrowLeft = Math.max(12, Math.min(tooltipRect.width - 12, anchorCenterX - left));
    setPosition({ top, left, arrowLeft, placement });
  }, [open, text]);

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  return (
    <span
      ref={triggerRef}
      onMouseEnter={() => {
        timeoutRef.current = window.setTimeout(() => setOpen(true), 150);
      }}
      onMouseLeave={() => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={tooltipRef}
            role="tooltip"
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
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.3,
              whiteSpace: "pre-line",
              zIndex: 900,
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
            <div style={{ position: "relative", zIndex: 1, lineHeight: 1.36, fontSize: 13, fontWeight: 500, color: "#F8FAFC" }}>
              {text}
            </div>
          </span>,
          document.body,
        )}
    </span>
  );
}
