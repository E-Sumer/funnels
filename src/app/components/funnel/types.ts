export interface FilterChip {
  id: number;
  label: string;
  field?: string;
  operator?: string;
  value?: string;
  valueTo?: string;
  joiner?: "AND" | "OR";
}

export interface FunnelStep {
  id: number;
  eventName: string;
  filters: FilterChip[];
  showExclude: boolean;
  excludeValue: string;
}

export interface FunnelDateRange {
  start: Date | null;
  end: Date | null;
}

export type FunnelOrderMode = "In strict order" | "In this order" | "Any order";

export interface FunnelExclusionConfig {
  enabled: boolean;
  eventName: string;
  filters: FilterChip[];
  scope: string;
}
