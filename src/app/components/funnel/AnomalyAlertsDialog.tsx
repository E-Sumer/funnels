import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, ChevronDown } from "lucide-react";
import { TinyTooltip } from "../ui/tiny-tooltip";

export interface AnomalyAlertConfig {
  id: string;
  title: string;
  metric_event: string;
  metric_parameter: string;
  direction: "decrease" | "increase" | "both";
  threshold_value: number;
  threshold_unit: "percent";
  evaluation_interval: "Hourly" | "Daily" | "Weekly";
  training_window_days: 120;
  notify_at_most: "Hourly" | "Daily" | "Weekly";
  recipients: string[];
}

interface StepOption {
  id: number;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave?: (alert: AnomalyAlertConfig) => void;
  steps?: StepOption[];
  userEmail?: string;
  initialAlert?: AnomalyAlertConfig | null;
}

const EVAL_OPTIONS: Array<AnomalyAlertConfig["evaluation_interval"]> = ["Hourly", "Daily", "Weekly"];
const METRIC_PARAMS = ["iOS", "Android", "Web", "API"];
const SYSTEM_EVENTS = [
  "Session Start",
  "Page View",
  "Product Detail Page View",
  "Added to Cart",
  "Purchase Initiated",
  "Purchased Completed",
  "Session End",
];

function inferUserEmail(explicit?: string) {
  if (explicit) return explicit;
  const lsEmail =
    localStorage.getItem("userEmail") ||
    localStorage.getItem("email") ||
    localStorage.getItem("currentUserEmail");
  return lsEmail ?? "";
}

export function AnomalyAlertsDialog({ open, onClose, onSave, steps: _steps = [], userEmail, initialAlert }: Props) {
  const metricEvents = useMemo(() => SYSTEM_EVENTS, []);

  const [title, setTitle] = useState("");
  const [metricEvent, setMetricEvent] = useState("");
  const [metricParameter, setMetricParameter] = useState("");
  const [direction, setDirection] = useState<AnomalyAlertConfig["direction"]>("decrease");
  const [thresholdValue, setThresholdValue] = useState("15");
  const [evaluationInterval, setEvaluationInterval] = useState<AnomalyAlertConfig["evaluation_interval"]>("Daily");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; metric?: string; threshold?: string; email?: string }>({});

  useEffect(() => {
    if (!open) return;
    const inferredEmail = inferUserEmail(userEmail);
    if (initialAlert) {
      setTitle(initialAlert.title);
      setMetricEvent(initialAlert.metric_event);
      setMetricParameter(initialAlert.metric_parameter === "All users" ? "" : initialAlert.metric_parameter);
      setDirection(initialAlert.direction);
      setThresholdValue(String(initialAlert.threshold_value));
      setEvaluationInterval(initialAlert.evaluation_interval);
      setRecipients(initialAlert.recipients);
      setShowAllRecipients(false);
      setRecipientInput("");
      setErrors({});
      return;
    }
    setMetricEvent("");
    setMetricParameter("");
    setDirection("decrease");
    setThresholdValue("15");
    setEvaluationInterval("Daily");
    setRecipients(inferredEmail ? [inferredEmail] : []);
    setShowAllRecipients(false);
    setTitle("");
    setRecipientInput("");
    setErrors({});
  }, [open, initialAlert, metricEvents, userEmail]);

  useEffect(() => {
    if (recipients.length <= 2) setShowAllRecipients(false);
  }, [recipients.length]);

  if (!open) return null;

  const thresholdNumber = Number(thresholdValue);
  const titleValid = title.trim().length > 0 && title.trim().length <= 80;
  const metricValid = Boolean(metricEvent);
  const thresholdValid = Number.isFinite(thresholdNumber) && thresholdNumber > 0;
  const emailValid = recipients.length > 0;
  const canSubmit = titleValid && metricValid && thresholdValid && emailValid;
  const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, 2);
  const hiddenRecipientCount = Math.max(0, recipients.length - 2);

  const addRecipient = () => {
    const next = recipientInput.trim();
    if (!next) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return;
    if (recipients.includes(next)) return;
    setRecipients((prev) => [...prev, next]);
    setShowAllRecipients(false);
    setRecipientInput("");
    setErrors((prev) => ({ ...prev, email: undefined }));
  };

  const submit = () => {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = "Title is required.";
    if (!metricEvent) nextErrors.metric = "Event is required.";
    if (!thresholdValid) nextErrors.threshold = "Enter a valid threshold.";
    if (!emailValid) nextErrors.email = "Email address is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave?.({
      id: initialAlert?.id ?? `alert-${Date.now()}`,
      title: title.trim(),
      metric_event: metricEvent,
      metric_parameter: metricParameter,
      direction,
      threshold_value: thresholdNumber,
      threshold_unit: "percent",
      evaluation_interval: evaluationInterval,
      training_window_days: 120,
      notify_at_most: "Daily",
      recipients,
    });
    onClose();
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(17,24,39,0.45)" }} onClick={onClose} />
      <div style={{ position: "fixed", inset: 0, zIndex: 510, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 640,
            maxHeight: "calc(100vh - 48px)",
            background: "white",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 10px", borderBottom: "1px solid #EEF0F4" }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>Set Up Funnel Anomaly Alert</h2>
            <button onClick={onClose} style={{ border: "none", background: "none", padding: 4, cursor: "pointer", color: "#9CA3AF" }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
            <div>
              <FieldLabel text="Title" />
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                placeholder="Give your anomaly setup a name"
                style={inputStyle(errors.title)}
              />
              {errors.title && <InlineError text={errors.title} />}
            </div>

            <div>
              <LabelWithTip
                label="Select Funnel Event to Monitor"
                tip="Select which step’s performance you want to track for anomalies."
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <SearchableSelect value={metricEvent} onChange={setMetricEvent} options={metricEvents} placeholder="Select Event" />
                <SearchableSelect value={metricParameter} onChange={setMetricParameter} options={METRIC_PARAMS} placeholder="Select Event Attribute (Optional)" />
              </div>
              {errors.metric && <InlineError text={errors.metric} />}
            </div>

            <div>
              <LabelWithTip label="Alert when" tip="Choose which type of change should trigger the alert." />
              <div style={{ display: "grid", gap: 8 }}>
                <RadioRow checked={direction === "decrease"} label="Metric decreases" onClick={() => setDirection("decrease")} />
                <RadioRow checked={direction === "increase"} label="Metric increases" onClick={() => setDirection("increase")} />
                <RadioRow checked={direction === "both"} label="Both increase and decrease" onClick={() => setDirection("both")} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "160px minmax(0,1fr)", gap: 10, alignItems: "start" }}>
              <div>
                <LabelWithTip label="Change Exceeds" tip="Alert triggers when the metric changes more than this amount from its expected value." />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={thresholdValue} onChange={(event) => setThresholdValue(event.target.value)} type="number" style={{ ...inputStyle(errors.threshold), width: 110 }} />
                  <span
                    style={{
                      height: 38,
                      minWidth: 38,
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#374151",
                      background: "white",
                    }}
                  >
                    %
                  </span>
                </div>
                {errors.threshold && <InlineError text={errors.threshold} />}
              </div>
              <div>
                <LabelWithTip
                  label="Evaluation Interval"
                  tip="Defines how often the system checks for anomalies and sends alerts via email."
                />
                <SearchableSelect
                  value={evaluationInterval}
                  onChange={(value) => setEvaluationInterval(value as AnomalyAlertConfig["evaluation_interval"])}
                  options={EVAL_OPTIONS}
                  placeholder="Select interval"
                  searchable={false}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Delivery</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={recipientInput}
                  onChange={(event) => setRecipientInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addRecipient();
                    }
                  }}
                  placeholder="name@company.com"
                  style={inputStyle()}
                />
                <button type="button" onClick={addRecipient} style={ghostBtnStyle}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {recipients.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {visibleRecipients.map((email) => (
                    <span key={email} style={chipStyle}>
                      {email}
                      <button type="button" onClick={() => setRecipients((prev) => prev.filter((item) => item !== email))} style={{ border: "none", background: "none", color: "#6366F1", cursor: "pointer", padding: 0 }}>
                        ×
                      </button>
                    </span>
                  ))}
                  {!showAllRecipients && hiddenRecipientCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllRecipients(true)}
                      style={{
                        ...chipStyle,
                        border: "1px solid #D1D5DB",
                        background: "white",
                        color: "#4B5563",
                        cursor: "pointer",
                      }}
                    >
                      +{hiddenRecipientCount} more
                    </button>
                  )}
                </div>
              )}
              {errors.email && <InlineError text={errors.email} />}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 18px", borderTop: "1px solid #EEF0F4" }}>
            <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
            <button onClick={submit} disabled={!canSubmit} style={primaryBtnStyle(canSubmit)}>
              Create alert
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>{text}</div>;
}

function FieldLabel({ text }: { text: string }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{text}</div>;
}

function LabelWithTip({ label, tip, compact = false }: { label: string; tip: string; compact?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: compact ? 4 : 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span>
      <TinyTooltip text={tip}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#B0B7C3" strokeWidth={2} style={{ flexShrink: 0, cursor: "help" }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" />
          <circle cx="12" cy="8" r="1" fill="#B0B7C3" stroke="none" />
        </svg>
      </TinyTooltip>
    </div>
  );
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0, width: 0 });
  const filtered = useMemo(() => {
    if (!searchable) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.toLowerCase().includes(q));
  }, [query, options, searchable]);

  const computeMenuPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(220, rect.width);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    let top = rect.bottom + 6;
    const estimateHeight = searchable ? 280 : 220;
    if (top + estimateHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimateHeight - 6);
    }
    setMenuPos({ left, top, width });
  };

  useEffect(() => {
    if (!open) return;
    computeMenuPos();
    const onReposition = () => computeMenuPos();
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) requestAnimationFrame(() => computeMenuPos());
            return next;
          });
        }}
        style={{
          ...dropdownButtonStyle(open),
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: value ? "#111827" : "#9CA3AF", fontSize: 12 }}>{value || placeholder}</span>
        <ChevronDown
          size={13}
          style={{
            color: "#9CA3AF",
            transform: `translateY(0) rotate(${open ? 180 : 0}deg)`,
            transition: "transform 0.16s",
          }}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: menuPos.left,
              top: menuPos.top,
              width: menuPos.width,
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
              zIndex: 860,
              padding: 8,
            }}
          >
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((prev) => Math.min(filtered.length - 1, prev + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((prev) => Math.max(0, prev - 1));
                } else if (event.key === "Enter" && filtered[activeIndex]) {
                  onChange(filtered[activeIndex]);
                  setOpen(false);
                  setQuery("");
                }
              }}
              placeholder="Search..."
              style={{ ...inputStyle(), height: 34, marginBottom: 8 }}
            />
          )}
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filtered.map((option, index) => (
              <button
                key={option}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                  setQuery("");
                }}
                style={{
                  width: "100%",
                  height: 34,
                  border: "none",
                  borderRadius: 8,
                  background: index === activeIndex ? "#F9FAFB" : value === option ? "#EEF4FF" : "white",
                  color: value === option ? "#1E3A8A" : "#374151",
                  textAlign: "left",
                  padding: "0 10px",
                  cursor: "pointer",
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function SimpleSelect({
  value,
  onChange,
  options,
  formatLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  formatLabel?: (value: string) => string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={{ ...dropdownButtonStyle(false), appearance: "none", cursor: "pointer" }}>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel ? formatLabel(option) : option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#9CA3AF",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function RadioRow({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 36,
        border: `1px solid ${checked ? "#4F83F1" : "#E5E7EB"}`,
        borderRadius: 8,
        background: checked ? "#EEF4FF" : "white",
        color: checked ? "#1E3A8A" : "#374151",
        fontSize: 12,
        fontWeight: 600,
        textAlign: "left",
        padding: "0 12px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${checked ? "#4F83F1" : "#9CA3AF"}`, background: checked ? "#4F83F1" : "white", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {checked && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "white" }} />}
      </span>
      {label}
    </button>
  );
}

function InlineError({ text }: { text: string }) {
  return <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF4444" }}>{text}</p>;
}

function inputStyle(error?: string): React.CSSProperties {
  return {
    width: "100%",
    height: 38,
    border: `1px solid ${error ? "#EF4444" : "#E5E7EB"}`,
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 13,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
    background: "white",
  };
}

function dropdownButtonStyle(open: boolean): React.CSSProperties {
  return {
    width: "100%",
    height: 40,
    border: `1px solid ${open ? "rgb(199, 210, 254)" : "#E5E7EB"}`,
    borderRadius: 8,
    padding: "0 30px 0 10px",
    fontSize: 12,
    color: "#111827",
    background: "white",
    outline: "none",
    boxSizing: "border-box",
    boxShadow: open ? "rgba(79, 131, 241, 0.12) 0 0 0 2px" : "none",
  };
}

const ghostBtnStyle: React.CSSProperties = {
  height: 36,
  border: "1px solid #E5E7EB",
  background: "white",
  borderRadius: 8,
  paddingInline: 14,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  color: "#4B5563",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

function primaryBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    height: 36,
    border: "none",
    background: enabled ? "#4F83F1" : "#C7D2FE",
    borderRadius: 8,
    paddingInline: 16,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: 13,
    fontWeight: 700,
    color: "white",
  };
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#EEF2FF",
  border: "1px solid #C7D2FE",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "#4338CA",
  fontWeight: 600,
};

