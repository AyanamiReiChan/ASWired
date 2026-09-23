export function systemUpdateLabel(phase: string, target?: string, current?: string): string {
 if (phase === 'failed' && target && target === current) return '版本已更新，升级检查未通过';
 const labels: Record<string, string> = {idle:'尚无升级任务',queued:'等待更新服务',updating:'升级进行中',completed:'升级完成',failed:'升级失败'};
 return labels[phase] ?? phase;
}
