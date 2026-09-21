import type { Row } from './data';

export function taskStatus(task: Row, servers: Row[], endpoints: Row[] = []) {
  const targetId = String(task.serverId ?? task.target ?? '');
  const server = servers.find(row => row.id === targetId);
  const endpoint = endpoints.find(row => row.id === targetId);
  const target = server ?? endpoint;
  const pending = ['待下发', 'queued'].includes(task.status);
  const running = ['执行中', 'running'].includes(task.status);
  const retired = ['superseded', 'cancelled', 'canceled', '已替代', '已取消', '已撤回'].includes(task.status);
  let message = '';
  if (pending) {
    if (target && ['停用', '禁用', 'disabled'].includes(target.status)) message = '目标已停用，任务暂不能下发。请先检查服务器状态。';
    else if (target?.status === '在线') message = '等待目标 Agent 领取任务；若长时间未变化，请检查连接和任务详情。';
    else if (target) message = `等待「${target.name ?? targetId}」的 Agent 连接主控，连接恢复后会自动下发。重试不会使它上线。`;
    else message = '等待目标执行端连接并领取任务；请核对目标身份及接入配置。';
  } else if (running) message = '任务已下发，正在等待目标 Agent 返回执行结果。';
  else if (retired) message = task.error || '此任务已撤回或被替代，不会继续下发。';
  const status = task.status === 'superseded' ? '已撤回' : ['cancelled', 'canceled'].includes(task.status) ? '已取消' : task.status;
  return {
    targetId,
    targetName: String(target?.name ?? targetId),
    address: String(target?.address ?? ''),
    serverURL: server ? `/servers?detail=${encodeURIComponent(targetId)}` : '',
    status,
    message,
    pending,
    running,
    retired,
    canRetry: !pending && !running && !retired
  };
}
