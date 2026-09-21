import type {Row} from './data';

export function canViewResourceDetails(role: string | undefined, collection: string) {
  return role === 'admin' || role === 'user' && collection !== 'nodes';
}
export function canCreateResource(role: string | undefined, collection: string, readonly = false) {
  return !readonly && role === 'admin';
}
export function canManageResource(role: string | undefined, collection: string, row: Row, readonly = false) {
  return canCreateResource(role, collection, readonly);
}
export function canTestNode(role: string | undefined, row: Row) {
  const protocol = String(row.uri ? String(row.uri).split(':')[0] : row.protocol ?? row.type ?? '').toLowerCase();
  if (['hysteria','hysteria2','hy2','tuic','wireguard','wg'].includes(protocol)) return false;
  return role === 'admin' || role === 'user' && row.subscriptionAuthorized === true && row.canTest === true;
}

const finishedTaskStatuses = new Set(['success', 'failed', 'unsupported', 'superseded', '成功', '失败', '不支持', '已撤回']);
export function canDeleteResource(role: string | undefined, collection: string, row: Row, readonly = false) {
  if (collection === 'audit') return role === 'admin';
  if (collection === 'tasks') return role === 'admin' && finishedTaskStatuses.has(row.status) && row.canDelete !== false;
  return canManageResource(role, collection, row, readonly);
}
