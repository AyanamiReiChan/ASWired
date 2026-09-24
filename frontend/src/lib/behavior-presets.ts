export type BehaviorPreset = 'balanced' | 'relaxed' | 'strict';
export type SustainedRule = {
  id: string;
  type: 'sustained';
  thresholdMbps: number;
  durationSeconds: number;
  limitMbps: number;
  penaltySeconds: number;
  priority: number;
  notify: boolean;
};
export type BehaviorConfig = { enabled: boolean; maxGapSeconds: number; rules: SustainedRule[] };

export const behaviorPresetOptions = [
  { value: 'balanced', label: '均衡（默认）' },
  { value: 'relaxed', label: '宽松' },
  { value: 'strict', label: '严格' },
];

const presets: Record<BehaviorPreset, BehaviorConfig> = {
  balanced: makePreset('balanced', [80, 600, 30, 600], [200, 120, 50, 600]),
  relaxed: makePreset('relaxed', [150, 900, 80, 600], [300, 180, 100, 300]),
  strict: makePreset('strict', [50, 600, 20, 900], [100, 120, 30, 600]),
};

function makePreset(id: string, long: number[], high: number[]): BehaviorConfig {
  const rule = (suffix: string, values: number[], priority: number): SustainedRule => ({
    id: `${id}-${suffix}`, type: 'sustained', thresholdMbps: values[0], durationSeconds: values[1],
    limitMbps: values[2], penaltySeconds: values[3], priority, notify: false,
  });
  return { enabled: true, maxGapSeconds: 15, rules: [rule('long', long, 10), rule('high', high, 20)] };
}

/** Each draft owns its rules so editing one cannot change a later default. */
export function createBehaviorPreset(id: string = 'balanced'): BehaviorConfig {
  if (!Object.hasOwn(presets, id)) throw new Error('未知的行为限速预设');
  return structuredClone(presets[id as BehaviorPreset]);
}

export function parseBehaviorDraft(value: string): { config: Record<string, any> | null; error: string } {
  try {
    const result = value.trim() ? JSON.parse(value) : null;
    if (result === null) return { config: null, error: '' };
    if (typeof result === 'object' && !Array.isArray(result)) return { config: result, error: '' };
    return { config: null, error: '规则必须为 JSON 对象' };
  } catch {
    return { config: null, error: '现有 JSON 无法解析，请在高级编辑中修正；原文已保留' };
  }
}

function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + stableJSON(item)).join(',') + '}';
  return JSON.stringify(value);
}

/** Recognition changes only the label; explicit/custom configurations stay intact. */
export function matchingBehaviorPreset(config: unknown): BehaviorPreset | null {
  const serialized = stableJSON(config);
  return (Object.keys(presets) as BehaviorPreset[]).find(id => stableJSON(presets[id]) === serialized) ?? null;
}

export function sustainedRuleSummary(rule: SustainedRule): string {
  const duration = (seconds: number) => seconds % 60 === 0 ? `${seconds / 60} 分钟` : `${seconds} 秒`;
  return `下载持续达到或超过 ${rule.thresholdMbps} Mbps 达 ${duration(rule.durationSeconds)}，限至 ${rule.limitMbps} Mbps，持续 ${duration(rule.penaltySeconds)}`;
}
