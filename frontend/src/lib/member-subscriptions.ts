import type {Row} from './data';

export function availableMemberPlans(plans: Row[], subscriptions: Row[]): Row[] {
 const bound = new Set(subscriptions.map(subscription => subscription.planId));
 return plans.filter(plan => !['停用', '暂停', '草稿', 'disabled'].includes(plan.status) && !bound.has(plan.id));
}

export function newMemberSubscription(member: Row, plan: Row, subscriptions: Row[], id: string, expires = ''): Row {
 if (!id || subscriptions.some(subscription => subscription.id === id)) throw new Error('请使用新的套餐实例');
 if (!availableMemberPlans([plan], subscriptions).length) throw new Error('此套餐已绑定或已停用，请选择其他套餐');
 return {id, name: `${member.username} · ${plan.name}`, memberId: member.id, planId: plan.id, limit: plan.limit ?? 0, expires, status: '启用'};
}

export type MergedSubscriptionEntry = {
 id: string; name: string; planId: string; plan: string; status: string; expires: string;
 active: boolean; unavailableReason?: string;
};
export type MergedSubscriptionView = {
 enabled: boolean; url: string; subscriptionIds: string[] | null; subscriptions: MergedSubscriptionEntry[];
};

export function mergedSubscriptionView(value: unknown): MergedSubscriptionView {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('无法读取合并订阅设置');
 const row = value as Record<string, unknown>;
 if (typeof row.enabled !== 'boolean' || !Array.isArray(row.subscriptions)) throw new Error('请升级主控后使用套餐选择功能');
 const subscriptions = row.subscriptions as MergedSubscriptionEntry[];
 if (subscriptions.some(item => !item || typeof item.id !== 'string' || !item.id || typeof item.active !== 'boolean') || new Set(subscriptions.map(item => item.id)).size !== subscriptions.length) throw new Error('套餐列表无效，请刷新后重试');
 const ids = row.subscriptionIds;
 if (ids != null && (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id))) throw new Error('合并订阅选择无效，请刷新后重试');
 return {enabled: row.enabled, url: typeof row.url === 'string' ? row.url : '', subscriptionIds: ids == null ? null : [...new Set(ids as string[])], subscriptions: subscriptions.map(item => ({...item}))};
}

export function sameSubscriptionSelection(left: string[] | null, right: string[] | null): boolean {
 if (left === null || right === null) return left === right;
 const a = new Set(left), b = new Set(right);
 return a.size === b.size && [...a].every(id => b.has(id));
}

export function mergedSubscriptionPayload(enabled: boolean, selection: string[] | null, subscriptions: MergedSubscriptionEntry[], rotate = false, previousSelection?: string[] | null) {
 // Revoking or rotating a link must remain possible after a selected instance was deleted.
 // An omitted selection preserves the stored subset; null would expand it to every plan.
 if ((!enabled || rotate) && previousSelection !== undefined && sameSubscriptionSelection(selection, previousSelection)) return {enabled, rotate};
 const subscriptionIds = selection === null ? null : [...new Set(selection)];
 if (enabled && subscriptionIds?.length === 0) throw new Error('请至少选择一个套餐，或关闭合并订阅');
 if (subscriptionIds?.some(id => !subscriptions.some(subscription => subscription.id === id))) throw new Error('所选套餐已不可用，请取消该选项后保存');
 return {enabled, rotate, subscriptionIds};
}

export function mergedSubscriptionAvailability(subscription: MergedSubscriptionEntry) {
 return subscription.active ? {value: '可用', kind: 'success'} : {value: '当前不可用', kind: 'warning'};
}

export function mergedSubscriptionURL(raw: string, format: string, origin?: string): string {
 if (!raw) return '';
 try {
  if (!/^https?:\/\//i.test(raw) && (!origin || !raw.startsWith('/') || raw.startsWith('//'))) return '';
  const url = new URL(raw, origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
  url.searchParams.set('format', format);
  return url.href;
 } catch { return ''; }
}
