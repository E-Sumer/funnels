import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Trash2, ChevronDown, MoreVertical, Loader2 } from "lucide-react";

export interface Filter {
  id: string;
  category: string;
  attribute: string;
  operator: string;
  value: string;
}

interface AudienceFilterSheetProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: Filter[]) => void;
}

interface RuleNode extends Filter {
  ruleType: string;
}

interface GroupNode {
  id: string;
  name: string;
  logic: "AND" | "OR";
  rules: RuleNode[];
  groups: GroupNode[];
}

const RULE_LIBRARY: Array<{ type: string; items: string[] }> = [
  { type: "Channel", items: ["Mobile", "Web", "SMS", "Email", "WhatsApp"] },
  { type: "Profile Attribute", items: ["Age", "Country", "Platform", "Group ID"] },
  { type: "Segment", items: ["VIP", "New Users", "Churn Risk", "High Intent"] },
  { type: "Tag", items: ["Promo", "Loyal", "Trial", "High Value"] },
  { type: "Platform", items: ["iOS", "Android", "Web", "Desktop"] },
  { type: "Response", items: ["blacklist (10100) (Message)", "Received", "Message Status"] },
  { type: "Message Category", items: ["ecem test", "welcome", "promo"] },
  { type: "Device Type", items: ["Phone", "Tablet", "Desktop", "TV"] },
  { type: "Device Model", items: ["iPhone 15", "Galaxy S24", "Pixel 9", "Redmi Note"] },
  { type: "Location Tracking", items: ["Enabled", "Disabled", "Unknown"] },
  { type: "App Installation", items: ["Installed", "Not Installed", "Uninstalled"] },
  { type: "App Version", items: ["1.0.0", "1.2.0", "2.0.0", "Latest"] },
  { type: "Operating System", items: ["iOS", "Android", "Windows", "macOS"] },
  { type: "Android Provider", items: ["Google Play", "Huawei", "Samsung", "Xiaomi"] },
  { type: "Operator", items: ["Turkcell", "Vodafone", "Turk Telekom", "Other"] },
];
const RULE_TYPES = RULE_LIBRARY.map((entry) => entry.type);
const ATTRIBUTES_BY_TYPE: Record<string, string[]> = Object.fromEntries(RULE_LIBRARY.map((entry) => [entry.type, entry.items]));
const OPERATORS_BY_TYPE: Record<string, string[]> = {
  "Profile Attribute": ["equals", "does not equal", "contains"],
  Response: ["received", "not received", "equals"],
  "Message Category": ["equals", "does not equal", "contains"],
  Segment: ["equals", "does not equal"],
};
const MAX_DEPTH = 3;

function nextId() {
  return String(Date.now() + Math.random());
}

function createRule(): RuleNode {
  return {
    id: nextId(),
    ruleType: RULE_TYPES[0],
    category: RULE_TYPES[0],
    attribute: "",
    operator: "equals",
    value: "",
  };
}

function createGroup(name: string): GroupNode {
  return {
    id: nextId(),
    name,
    logic: "AND",
    rules: [createRule()],
    groups: [],
  };
}

function getAllGroups(groups: GroupNode[]): GroupNode[] {
  const result: GroupNode[] = [];
  const walk = (nodes: GroupNode[]) => {
    nodes.forEach((group) => {
      result.push(group);
      if (group.groups.length) walk(group.groups);
    });
  };
  walk(groups);
  return result;
}

function nextGroupName(groups: GroupNode[]) {
  const count = getAllGroups(groups).length;
  if (count < 26) return `Group ${String.fromCharCode(65 + count)}`;
  return `Group ${count + 1}`;
}

function updateGroupById(groups: GroupNode[], groupId: string, updater: (group: GroupNode) => GroupNode): GroupNode[] {
  return groups.map((group) => {
    if (group.id === groupId) return updater(group);
    if (!group.groups.length) return group;
    return { ...group, groups: updateGroupById(group.groups, groupId, updater) };
  });
}

function removeGroupById(groups: GroupNode[], groupId: string): GroupNode[] {
  return groups
    .filter((group) => group.id !== groupId)
    .map((group) => ({ ...group, groups: removeGroupById(group.groups, groupId) }));
}

function cloneGroupTree(group: GroupNode, rootName?: string): GroupNode {
  return {
    ...group,
    id: nextId(),
    name: rootName ?? group.name,
    rules: group.rules.map((rule) => ({ ...rule, id: nextId() })),
    groups: group.groups.map((child) => cloneGroupTree(child)),
  };
}

function duplicateGroupAtLevel(groups: GroupNode[], groupId: string, rootName: string): GroupNode[] {
  const cloneGroup = (group: GroupNode): GroupNode => cloneGroupTree(group, rootName);

  const next: GroupNode[] = [];
  groups.forEach((group) => {
    next.push(group);
    if (group.id === groupId) next.push(cloneGroup(group));
    else if (group.groups.length) {
      next[next.length - 1] = { ...group, groups: duplicateGroupAtLevel(group.groups, groupId, rootName) };
    }
  });
  return next;
}

function flattenRules(groups: GroupNode[]): Filter[] {
  const all: Filter[] = [];
  const walk = (nodes: GroupNode[]) => {
    nodes.forEach((group) => {
      group.rules.forEach((rule) => {
        all.push({
          id: rule.id,
          category: rule.category,
          attribute: rule.attribute,
          operator: rule.operator,
          value: rule.value,
        });
      });
      if (group.groups.length) walk(group.groups);
    });
  };
  walk(groups);
  return all;
}

function isRuleComplete(rule: RuleNode) {
  const requiresValue = rule.ruleType !== "Segment";
  return (
    Boolean(rule.ruleType.trim()) &&
    Boolean(rule.attribute.trim()) &&
    Boolean(rule.operator.trim()) &&
    (!requiresValue || Boolean(rule.value.trim()))
  );
}

function isGroupTreeValid(groups: GroupNode[], isRoot = true): boolean {
  for (const group of groups) {
    if (!isRoot && group.rules.length === 0) return false;
    if (group.rules.some((rule) => !isRuleComplete(rule))) return false;
    if (!isGroupTreeValid(group.groups, false)) return false;
  }
  return true;
}

function SelectField({
  value,
  options,
  placeholder,
  onChange,
  className = "",
  hasError = false,
  searchable = false,
  searchPlaceholder = "Search...",
}: {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (next: string) => void;
  className?: string;
  hasError?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0, width: 0 });
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filteredOptions = useMemo(
    () =>
      searchable && query.trim()
        ? options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()))
        : options,
    [options, query, searchable],
  );

  const computeMenuPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 120);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    const estimatedHeight = Math.min(300, options.length * 36 + 10);
    let top = rect.bottom + 6;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 6);
    }
    setMenuPos({ left, top, width });
  };

  useEffect(() => {
    if (!open) return;
    computeMenuPos();
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReposition = () => computeMenuPos();
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full h-9 rounded-lg border bg-white px-2 pr-7 text-[12px] text-[#212121] outline-none text-left ${
          hasError ? "border-[#EF4444]" : "border-[#E5E7EB]"
        }`}
        title={value || placeholder}
      >
        <span className={`block w-full overflow-hidden text-ellipsis whitespace-nowrap ${value ? "text-[#212121]" : "text-[#9CA3AF]"}`}>
          {value || placeholder}
        </span>
      </button>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-[#9CA3AF]" />
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="rounded-lg border border-[#E5E7EB] bg-white shadow-lg p-1"
            style={{
              position: "fixed",
              left: menuPos.left,
              top: menuPos.top,
              width: menuPos.width,
              zIndex: 760,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {searchable && (
              <div className="px-1 pb-1">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 rounded-md border border-[#E5E7EB] px-2 text-[12px] text-[#111827] outline-none focus:border-[#4F83F1]"
                />
              </div>
            )}
            {filteredOptions.map((option) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  title={option}
                  className={`w-full h-9 rounded-md px-2 text-left text-[12px] transition-colors ${
                    selected ? "bg-[#EEF4FF] text-[#1E3A8A]" : "text-[#374151] hover:bg-[#F8FAFC]"
                  }`}
                >
                  <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">{option}</span>
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="px-2 py-2 text-[12px] text-[#9CA3AF]">No results</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function RuleTypeField({
  ruleType,
  attribute,
  onSelect,
  className = "",
  hasError = false,
  autoOpen = false,
  onAutoOpenHandled,
}: {
  ruleType: string;
  attribute: string;
  onSelect: (ruleType: string, attribute: string) => void;
  className?: string;
  hasError?: boolean;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0, width: 0 });
  const [activeType, setActiveType] = useState(ruleType || RULE_LIBRARY[0]?.type || "");
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const computeMenuPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(Math.max(620, rect.width), window.innerWidth - 24);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    let top = rect.bottom + 6;
    const estimatedHeight = 430;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 6);
    }
    setMenuPos({ left, top, width });
  };

  useEffect(() => {
    if (!open) return;
    computeMenuPos();
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReposition = () => computeMenuPos();
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!autoOpen) return;
    setOpen(true);
    onAutoOpenHandled?.();
  }, [autoOpen, onAutoOpenHandled]);

  useEffect(() => {
    if (!open) return;
    setActiveType(ruleType || RULE_LIBRARY[0]?.type || "");
  }, [open, ruleType]);

  const activeItems = ATTRIBUTES_BY_TYPE[activeType] ?? [];
  const filteredItems = activeItems.filter((item) => item.toLowerCase().includes(search.toLowerCase()));
  const triggerLabel = ruleType || "Rule Type";

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full h-9 rounded-lg border bg-white px-2 pr-7 text-[12px] text-[#212121] outline-none text-left ${
          hasError ? "border-[#EF4444]" : "border-[#E5E7EB]"
        }`}
      >
        <span className={`block w-full overflow-hidden text-ellipsis whitespace-nowrap ${ruleType ? "text-[#212121]" : "text-[#9CA3AF]"}`}>
          {triggerLabel}
        </span>
      </button>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-[#9CA3AF]" />

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="rounded-xl border border-[#E5E7EB] bg-white shadow-lg overflow-hidden"
            style={{
              position: "fixed",
              left: menuPos.left,
              top: menuPos.top,
              width: menuPos.width,
              zIndex: 760,
              maxHeight: 430,
            }}
          >
            <div className="grid grid-cols-[240px_1fr] h-[430px]">
              <div className="border-r border-[#E5E7EB] p-2 overflow-y-auto">
                {RULE_LIBRARY.map((item) => {
                  const selected = item.type === activeType;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setActiveType(item.type)}
                      className={`w-full h-10 rounded-md px-3 text-left text-[12px] transition-colors ${
                        selected ? "bg-[#EAF4FF] text-[#1D4ED8]" : "text-[#374151] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {item.type}
                    </button>
                  );
                })}
              </div>
              <div className="p-3 overflow-y-auto">
                <div className="mb-2">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search in ${activeType}`}
                    className="w-full h-9 rounded-md border border-[#E5E7EB] px-3 text-[12px] outline-none focus:border-[#4F83F1]"
                  />
                </div>
                <div className="space-y-2">
                  {filteredItems.map((item) => {
                    const selected = ruleType === activeType && attribute === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          onSelect(activeType, item);
                          setOpen(false);
                          setSearch("");
                        }}
                        className={`w-full h-10 rounded-md px-3 text-left text-[13px] transition-colors ${
                          selected ? "bg-[#EEF4FF] text-[#1E3A8A]" : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function RuleRow({
  rule,
  showErrors,
  autoOpenTypeMenu,
  onAutoOpenTypeMenuHandled,
  onChange,
  onRemove,
}: {
  rule: RuleNode;
  showErrors: boolean;
  autoOpenTypeMenu: boolean;
  onAutoOpenTypeMenuHandled: () => void;
  onChange: (next: RuleNode) => void;
  onRemove: () => void;
}) {
  const attributes = ATTRIBUTES_BY_TYPE[rule.ruleType] ?? ATTRIBUTES_BY_TYPE["Profile Attribute"];
  const operators = OPERATORS_BY_TYPE[rule.ruleType] ?? OPERATORS_BY_TYPE["Profile Attribute"];
  const isSegmentType = rule.ruleType === "Segment";
  const hasAttributeError = showErrors && !rule.attribute.trim();
  const hasOperatorError = showErrors && !rule.operator.trim();
  const hasValueError = showErrors && !isSegmentType && !rule.value.trim();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 overflow-hidden">
      <RuleTypeField
        ruleType={rule.ruleType}
        attribute={rule.attribute}
        autoOpen={autoOpenTypeMenu}
        onAutoOpenHandled={onAutoOpenTypeMenuHandled}
        className="flex-[1.2] min-w-0"
        onSelect={(ruleType, attribute) =>
          onChange({
            ...rule,
            ruleType,
            category: ruleType,
            attribute,
            operator: "equals",
            value: "",
          })
        }
      />
      {isSegmentType ? (
        <>
          <SelectField
            value={rule.operator}
            placeholder="Operator"
            options={operators}
            className="flex-[1] min-w-0"
            hasError={hasOperatorError}
            onChange={(operator) => onChange({ ...rule, operator })}
          />
          <SelectField
            value={rule.attribute}
            placeholder="Field"
            options={attributes}
            className="flex-[1.2] min-w-0"
            hasError={hasAttributeError}
            searchable
            searchPlaceholder="Search segments"
            onChange={(attribute) => onChange({ ...rule, attribute })}
          />
        </>
      ) : (
        <>
          <SelectField
            value={rule.attribute}
            placeholder="Field"
            options={attributes}
            className="flex-[1.2] min-w-0"
            hasError={hasAttributeError}
            onChange={(attribute) => onChange({ ...rule, attribute })}
          />
          <SelectField
            value={rule.operator}
            placeholder="Operator"
            options={operators}
            className="flex-[1] min-w-0"
            hasError={hasOperatorError}
            onChange={(operator) => onChange({ ...rule, operator })}
          />
          <input
            className={`h-9 flex-[1.3] min-w-0 rounded-lg border bg-white px-2 text-[12px] text-[#212121] outline-none ${
              hasValueError ? "border-[#EF4444] focus:border-[#EF4444]" : "border-[#E5E7EB] focus:border-[#4F83F1]"
            }`}
            placeholder={rule.ruleType === "Response" ? "Select date option" : "Enter value..."}
            value={rule.value}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
          />
        </>
      )}
      <button
        onClick={onRemove}
        className="shrink-0 text-[#B8BDC8] hover:text-[#EF4444] transition-colors"
        title="Remove rule"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function LogicConnector({
  logic,
  editable = false,
  onChange,
}: {
  logic: "AND" | "OR";
  editable?: boolean;
  onChange?: (logic: "AND" | "OR") => void;
}) {
  if (editable && onChange) {
    return (
      <div className="pl-3 w-[86px]">
        <SelectField
          value={logic}
          placeholder="Logic"
          options={["AND", "OR"]}
          className="w-full"
          onChange={(next) => onChange(next as "AND" | "OR")}
        />
      </div>
    );
  }
  return (
    <div className="pl-3">
      <span className="inline-flex h-6 min-w-14 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-2 text-[12px] font-medium text-[#6B7280]">
        {logic}
      </span>
    </div>
  );
}

function GroupCard({
  group,
  depth,
  root = false,
  selectedGroupId,
  editingGroupId,
  groupNameDraft,
  onSelectGroup,
  onBeginRename,
  onDraftRename,
  onCommitRename,
  onCancelRename,
  onAddRule,
  onAddSubgroup,
  onUpdate,
  onDuplicateGroup,
  onDeleteGroup,
  showValidationErrors,
  autoOpenTypeMenuRuleId,
  onAutoOpenTypeMenuHandled,
}: {
  group: GroupNode;
  depth: number;
  root?: boolean;
  selectedGroupId: string | null;
  editingGroupId: string | null;
  groupNameDraft: string;
  onSelectGroup: (groupId: string) => void;
  onBeginRename: (groupId: string, currentName: string) => void;
  onDraftRename: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onAddRule: (groupId: string) => void;
  onAddSubgroup: (groupId: string, depth: number) => void;
  onUpdate: (groupId: string, updater: (group: GroupNode) => GroupNode) => void;
  onDuplicateGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  showValidationErrors: boolean;
  autoOpenTypeMenuRuleId: string | null;
  onAutoOpenTypeMenuHandled: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (!menuWrapRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen]);

  return (
    <div
      onClick={() => onSelectGroup(group.id)}
      className={`rounded-lg border p-3 transition-colors ${
        selectedGroupId === group.id ? "border-[#8FA2FF]" : "border-[#C7D2FE]"
      }`}
      style={{
        marginLeft: depth > 0 ? 18 : 0,
        background: depth === 0 ? "#FBFCFF" : depth === 1 ? "#FCFCFF" : "#FDFDFF",
        borderLeftWidth: depth > 0 ? 2 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-2 min-w-0">
          {editingGroupId === group.id ? (
            <input
              autoFocus
              value={groupNameDraft}
              onChange={(event) => onDraftRename(event.target.value)}
              onBlur={onCommitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") onCommitRename();
                if (event.key === "Escape") onCancelRename();
              }}
              className="h-7 rounded-md border border-[#C7D2FE] bg-white px-2 text-[12px] font-semibold text-[#4253D8] outline-none"
            />
          ) : (
            <span className="rounded-md bg-[#5566E8] px-2 py-0.5 text-[12px] font-semibold text-white truncate max-w-[130px]">
              {group.name}
            </span>
          )}
          <SelectField
            value={group.logic}
            placeholder="Logic"
            options={["AND", "OR"]}
            className="w-[78px]"
            onChange={(logic) => onUpdate(group.id, (current) => ({ ...current, logic: logic as "AND" | "OR" }))}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onAddRule(group.id);
            }}
            className="text-[#3B82F6] hover:text-[#2563EB] transition-colors text-[12px] font-medium"
          >
            Add Rule
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onAddSubgroup(group.id, depth);
            }}
            disabled={depth >= MAX_DEPTH - 1}
            className="text-[#3B82F6] hover:text-[#2563EB] transition-colors text-[12px] font-medium disabled:text-[#9CA3AF]"
          >
            Add Subgroup
          </button>
          <div ref={menuWrapRef} className="relative">
            <button
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              className="size-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#4B5563]"
            >
              <MoreVertical className="size-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] w-32 rounded-lg border border-[#E5E7EB] bg-white shadow-lg z-20 py-1">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onBeginRename(group.id, group.name);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-[12px] text-[#374151] hover:bg-[#F8FAFC]"
                >
                  Rename
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicateGroup(group.id);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-[12px] text-[#374151] hover:bg-[#F8FAFC]"
                >
                  Duplicate
                </button>
                {!root && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteGroup(group.id);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-[#EF4444] hover:bg-[#FFF5F5]"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {group.rules.map((rule, index) => (
          <div key={rule.id} className="space-y-2">
            {index > 0 && <LogicConnector logic={group.logic} />}
            <RuleRow
              rule={rule}
              showErrors={showValidationErrors}
              autoOpenTypeMenu={autoOpenTypeMenuRuleId === rule.id}
              onAutoOpenTypeMenuHandled={onAutoOpenTypeMenuHandled}
              onChange={(next) =>
                onUpdate(group.id, (current) => ({
                  ...current,
                  rules: current.rules.map((item) => (item.id === next.id ? next : item)),
                }))
              }
              onRemove={() =>
                onUpdate(group.id, (current) => ({
                  ...current,
                  rules: current.rules.filter((item) => item.id !== rule.id),
                }))
              }
            />
          </div>
        ))}
      </div>
      {showValidationErrors && !root && group.rules.length === 0 && (
        <p className="mt-2 text-[11px] text-[#EF4444]">Add at least one rule to this subgroup.</p>
      )}

      {group.groups.length > 0 && (
        <div className="mt-2 space-y-2">
          {group.groups.map((child, index) => (
            <div key={child.id} className="space-y-2">
              {(group.rules.length > 0 || index > 0) && <LogicConnector logic={group.logic} />}
              <GroupCard
                group={child}
                depth={depth + 1}
                selectedGroupId={selectedGroupId}
                editingGroupId={editingGroupId}
                groupNameDraft={groupNameDraft}
                onSelectGroup={onSelectGroup}
                onBeginRename={onBeginRename}
                onDraftRename={onDraftRename}
                onCommitRename={onCommitRename}
                onCancelRename={onCancelRename}
                onAddRule={onAddRule}
                onAddSubgroup={onAddSubgroup}
                onUpdate={onUpdate}
                onDuplicateGroup={onDuplicateGroup}
                onDeleteGroup={onDeleteGroup}
                showValidationErrors={showValidationErrors}
                autoOpenTypeMenuRuleId={autoOpenTypeMenuRuleId}
                onAutoOpenTypeMenuHandled={onAutoOpenTypeMenuHandled}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StructuredSummary({
  topLevelRules = [],
  groups,
  depth = 0,
}: {
  topLevelRules?: RuleNode[];
  groups: GroupNode[];
  depth?: number;
}) {
  return (
    <div className="mt-2 space-y-1 text-[12px] text-[#374151]">
      {depth === 0 &&
        topLevelRules.map((rule) => (
          <p key={rule.id} className="rounded border border-[#EEF0F4] bg-[#FAFBFF] px-2 py-1 my-1">
            {rule.ruleType === "Segment"
              ? `• Segment ${rule.operator} ${rule.attribute || "(segment)"}`
              : `• ${rule.attribute || "(field)"} ${rule.operator} ${rule.value || "(value)"}`}
          </p>
        ))}
      {groups.map((group) => (
        <div key={group.id} style={{ marginLeft: depth * 14 }}>
          <p className="font-semibold">{`${group.name.toUpperCase()} (${group.logic})`}</p>
          {group.rules.map((rule) => (
            <p key={rule.id} className="rounded border border-[#EEF0F4] bg-[#FAFBFF] px-2 py-1 my-1">
              {rule.ruleType === "Segment"
                ? `• Segment ${rule.operator} ${rule.attribute || "(segment)"}`
                : `• ${rule.attribute || "(field)"} ${rule.operator} ${rule.value || "(value)"}`}
            </p>
          ))}
          {group.groups.length > 0 && <StructuredSummary groups={group.groups} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}

export function AudienceFilterSheet({ open, onClose, onApply }: AudienceFilterSheetProps) {
  const [topLevelRules, setTopLevelRules] = useState<RuleNode[]>([]);
  const [groups, setGroups] = useState<GroupNode[]>([]);
  const [topLevelLogic, setTopLevelLogic] = useState<"AND" | "OR">("OR");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [autoOpenTypeMenuRuleId, setAutoOpenTypeMenuRuleId] = useState<string | null>(null);
  const [isAudienceLoading, setIsAudienceLoading] = useState(false);
  const [displayAudienceCount, setDisplayAudienceCount] = useState(320012);
  const [showSaveSegmentModal, setShowSaveSegmentModal] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const audienceTimeoutRef = useRef<number | null>(null);
  const hasInitializedAudienceRef = useRef(false);

  const resetBuilderState = () => {
    setTopLevelRules([]);
    setGroups([]);
    setTopLevelLogic("OR");
    setSelectedGroupId(null);
    setEditingGroupId(null);
    setGroupNameDraft("");
    setSubmitAttempted(false);
    setAutoOpenTypeMenuRuleId(null);
    setIsAudienceLoading(false);
    setDisplayAudienceCount(320012);
    setShowSaveSegmentModal(false);
  };

  useEffect(() => {
    if (open) resetBuilderState();
  }, [open]);

  useEffect(() => {
    return () => {
      if (audienceTimeoutRef.current) window.clearTimeout(audienceTimeoutRef.current);
    };
  }, []);

  const updateGroup = (groupId: string, updater: (group: GroupNode) => GroupNode) => {
    setGroups((prev) => updateGroupById(prev, groupId, updater));
  };

  const addRuleToGroup = (groupId: string) => {
    const newRule = createRule();
    updateGroup(groupId, (group) => ({ ...group, rules: [...group.rules, newRule] }));
    setAutoOpenTypeMenuRuleId(newRule.id);
  };

  const addTopLevelRule = () => {
    const newRule = createRule();
    setTopLevelRules((prev) => [...prev, newRule]);
    setAutoOpenTypeMenuRuleId(newRule.id);
  };

  const addTopLevelGroup = () => {
    setGroups((prev) => [...prev, createGroup(nextGroupName(prev))]);
  };

  const addSubgroupToGroup = (groupId: string, depth: number) => {
    if (depth >= MAX_DEPTH - 1) return;
    setGroups((prev) => {
      const subgroup = createGroup(nextGroupName(prev));
      setSelectedGroupId(subgroup.id);
      setEditingGroupId(subgroup.id);
      setGroupNameDraft(subgroup.name);
      return updateGroupById(prev, groupId, (group) => ({ ...group, groups: [...group.groups, subgroup] }));
    });
  };

  const removeGroup = (groupId: string) => {
    const target = getAllGroups(groups).find((group) => group.id === groupId);
    if (!target) return;
    if (target.groups.length > 0) {
      const confirmed = window.confirm("Delete this subgroup and all nested children?");
      if (!confirmed) return;
    }
    setGroups((prev) => removeGroupById(prev, groupId));
    setSelectedGroupId((prev) => (prev === groupId ? null : prev));
  };

  const duplicateGroup = (groupId: string) => {
    setGroups((prev) => {
      const rootId = prev[0]?.id;
      const target = getAllGroups(prev).find((group) => group.id === groupId);
      if (!target) return prev;
      const duplicateName = nextGroupName(prev);

      if (groupId === rootId) {
        const clone = cloneGroupTree(target, duplicateName);
        return updateGroupById(prev, rootId, (root) => ({
          ...root,
          groups: [...root.groups, clone],
        }));
      }

      return duplicateGroupAtLevel(prev, groupId, duplicateName);
    });
  };

  const commitRenameGroup = () => {
    if (!editingGroupId) return;
    const nextName = groupNameDraft.trim();
    if (nextName) {
      setGroups((prev) =>
        updateGroupById(prev, editingGroupId, (group) => ({
          ...group,
          name: nextName,
        })),
      );
    }
    setEditingGroupId(null);
    setGroupNameDraft("");
  };

  const topLevelFilters = useMemo(
    () =>
      topLevelRules.map((rule) => ({
        id: rule.id,
        category: rule.category,
        attribute: rule.attribute,
        operator: rule.operator,
        value: rule.value,
      })),
    [topLevelRules],
  );
  const flattenedFilters = useMemo(() => flattenRules(groups), [groups]);
  const appliedFilters = useMemo(
    () =>
      [...topLevelFilters, ...flattenedFilters].filter(
        (filter) =>
          Boolean(filter.attribute.trim()) &&
          Boolean(filter.operator.trim()) &&
          (filter.category === "Segment" || Boolean(filter.value.trim())),
      ),
    [flattenedFilters, topLevelFilters],
  );
  const targetAudienceCount = useMemo(
    () => Math.max(1, Math.floor(320012 / Math.pow(2, appliedFilters.length))),
    [appliedFilters.length],
  );
  const isValidBuilder = useMemo(
    () => topLevelRules.every((rule) => isRuleComplete(rule)) && isGroupTreeValid(groups),
    [groups, topLevelRules],
  );
  const topLevelItems = useMemo(
    () => [
      ...topLevelRules.map((rule) => ({ kind: "rule" as const, id: rule.id, rule })),
      ...groups.map((group) => ({ kind: "group" as const, id: group.id, group })),
    ],
    [groups, topLevelRules],
  );
  const firstTopLevelGroupId = useMemo(
    () => topLevelItems.find((item) => item.kind === "group")?.id ?? null,
    [topLevelItems],
  );

  useEffect(() => {
    if (!open) {
      hasInitializedAudienceRef.current = false;
      return;
    }
    if (!hasInitializedAudienceRef.current) {
      hasInitializedAudienceRef.current = true;
      setDisplayAudienceCount(targetAudienceCount);
      setIsAudienceLoading(false);
      return;
    }
    setIsAudienceLoading(true);
    if (audienceTimeoutRef.current) window.clearTimeout(audienceTimeoutRef.current);
    audienceTimeoutRef.current = window.setTimeout(() => {
      setDisplayAudienceCount(targetAudienceCount);
      setIsAudienceLoading(false);
    }, 2000);
  }, [targetAudienceCount, open]);

  const handleCloseSheet = () => {
    if (audienceTimeoutRef.current) {
      window.clearTimeout(audienceTimeoutRef.current);
      audienceTimeoutRef.current = null;
    }
    resetBuilderState();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/30" onClick={handleCloseSheet} />
      <div className="fixed inset-0 z-[310] flex items-center justify-center p-5">
        <div className="w-full max-w-[1040px] rounded-xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden">
          <div className="flex items-start justify-between border-b border-[#EDEDED] px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold text-[#212121]">Filter Audience</h2>
              <p className="mt-1 text-[12px] text-[#9CA3AF]">Choose segment to target for this experience</p>
            </div>
            <button onClick={handleCloseSheet} className="text-[#8A8A8A] hover:text-[#212121] transition-colors">
              <X className="size-5" />
            </button>
          </div>

          <div className="grid grid-cols-[1.5fr_1fr] gap-4 px-5 py-4">
            <div className="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
              {topLevelRules.length === 0 && groups.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#D7DCE5] bg-[#FAFBFF] px-4 py-6 text-center">
                  <p className="text-[13px] font-medium text-[#4B5563]">
                    Add a Filter Rule or Filter Group to start segmenting your users.
                  </p>
                </div>
              )}
              {topLevelItems.map((item, index) => (
                <div key={item.id} className="space-y-2">
                  {index > 0 && (
                    <LogicConnector
                      logic={topLevelLogic}
                      editable={index === 1}
                      onChange={setTopLevelLogic}
                    />
                  )}
                  {item.kind === "rule" ? (
                    <RuleRow
                      rule={item.rule}
                      showErrors={submitAttempted}
                      autoOpenTypeMenu={autoOpenTypeMenuRuleId === item.rule.id}
                      onAutoOpenTypeMenuHandled={() => setAutoOpenTypeMenuRuleId(null)}
                      onChange={(next) =>
                        setTopLevelRules((prev) => prev.map((current) => (current.id === next.id ? next : current)))
                      }
                      onRemove={() => setTopLevelRules((prev) => prev.filter((current) => current.id !== item.rule.id))}
                    />
                  ) : (
                    <GroupCard
                      group={item.group}
                      depth={0}
                      root={item.group.id === firstTopLevelGroupId}
                      selectedGroupId={selectedGroupId}
                      editingGroupId={editingGroupId}
                      groupNameDraft={groupNameDraft}
                      onSelectGroup={setSelectedGroupId}
                      onBeginRename={(groupId, currentName) => {
                        setEditingGroupId(groupId);
                        setGroupNameDraft(currentName);
                      }}
                      onDraftRename={setGroupNameDraft}
                      onCommitRename={commitRenameGroup}
                      onCancelRename={() => {
                        setEditingGroupId(null);
                        setGroupNameDraft("");
                      }}
                      onAddRule={addRuleToGroup}
                      onAddSubgroup={addSubgroupToGroup}
                      onUpdate={updateGroup}
                      onDuplicateGroup={duplicateGroup}
                      onDeleteGroup={removeGroup}
                      showValidationErrors={submitAttempted}
                      autoOpenTypeMenuRuleId={autoOpenTypeMenuRuleId}
                      onAutoOpenTypeMenuHandled={() => setAutoOpenTypeMenuRuleId(null)}
                    />
                  )}
                </div>
              ))}
              <div className="flex items-center gap-3 text-[12px] font-medium pt-1">
                <button
                  onClick={addTopLevelRule}
                  className="h-8 rounded-md border border-[#E5E7EB] bg-white px-3 text-[#374151] hover:bg-[#F8FAFC] transition-colors"
                >
                  Add Filter Rule
                </button>
                <button
                  onClick={addTopLevelGroup}
                  className="h-8 rounded-md border border-[#E5E7EB] bg-white px-3 text-[#374151] hover:bg-[#F8FAFC] transition-colors"
                >
                  Add Filter Group
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                <h3 className="text-[13px] font-semibold text-[#212121] border-l-2 border-[#212121] pl-2">Rule Description</h3>
                <div className="mt-3 rounded-lg border border-[#8FA2FF] p-2">
                  <StructuredSummary topLevelRules={topLevelRules} groups={groups} />
                </div>
              </div>

              <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                <h3 className="text-[13px] font-semibold text-[#212121] border-l-2 border-[#212121] pl-2">Target Audience</h3>
                <div className="mt-3 rounded-md border border-[#EEF0F4] bg-[#FAFBFF] px-3 py-2 flex items-center justify-between">
                  <span className="text-[12px] text-[#374151]">Number of Users</span>
                  {isAudienceLoading ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#4F83F1]">
                      <Loader2 className="size-3.5 animate-spin" />
                      Calculating...
                    </span>
                  ) : (
                    <span className="text-[12px] font-semibold text-[#4F83F1]">{displayAudienceCount.toLocaleString("en-US")}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#EDEDED] px-5 py-4">
            <button
              onClick={() => setShowSaveSegmentModal(true)}
              className="h-9 rounded-md border border-[#93C5FD] px-4 text-[12px] font-semibold text-[#4F83F1] hover:bg-[#EEF4FF] transition-colors"
            >
              Save as Segment
            </button>
            <div className="flex items-end gap-3">
              {submitAttempted && !isValidBuilder && (
                <span className="text-[11px] text-[#EF4444]">
                  Add at least one complete rule in every subgroup before applying.
                </span>
              )}
              <button
                onClick={() => {
                  if (!isValidBuilder) {
                    setSubmitAttempted(true);
                    return;
                  }
                  setSubmitAttempted(false);
                  onApply(appliedFilters);
                  handleCloseSheet();
                }}
                className="h-9 rounded-md bg-[#10B981] px-6 text-[12px] font-semibold text-white hover:bg-[#0EA571] transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
      {showSaveSegmentModal && (
        <div className="fixed inset-0 z-[380] flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/25" onClick={() => setShowSaveSegmentModal(false)} />
          <div className="relative z-[381] w-full max-w-[520px] rounded-xl border border-[#E5E7EB] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#EDEDED] px-5 py-4">
              <div>
                <h3 className="text-[16px] font-semibold text-[#212121]">Save This Segment As</h3>
                <p className="mt-1 text-[12px] text-[#6B7280]">
                  Give your applied segment filters a name. You can use this segment in other products later.
                </p>
              </div>
              <button
                onClick={() => setShowSaveSegmentModal(false)}
                className="text-[#8A8A8A] hover:text-[#212121] transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-[12px] font-medium text-[#374151] mb-1">Segment Name</label>
              <input
                value={segmentName}
                onChange={(event) => setSegmentName(event.target.value)}
                placeholder="Enter segment name"
                className="w-full h-10 rounded-md border border-[#E5E7EB] px-3 text-[12px] outline-none focus:border-[#4F83F1]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#EDEDED] px-5 py-4">
              <button
                onClick={() => setShowSaveSegmentModal(false)}
                className="h-9 rounded-md border border-[#E5E7EB] px-4 text-[12px] font-semibold text-[#374151] hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSaveSegmentModal(false)}
                className="h-9 rounded-md bg-[#4F83F1] px-4 text-[12px] font-semibold text-white hover:bg-[#3D73E3]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}