type UpdateServer = {
 [key: string]: unknown;
 status?: string;
 capabilities?: Record<string, boolean>;
 agentUpdate?: {status?: string};
};

const pendingStates = new Set(['staged', 'ready', 'restarting', 'healthy']);

export function agentUpdateBlockReason(server: UpdateServer): string {
 if (server.status !== '在线') return 'Agent 未在线';
 if (!server.capabilities?.agent_update) return '未启用安全升级，需要迁移服务启动方式';
 if (pendingStates.has(server.agentUpdate?.status ?? '')) return '上一轮升级尚未完成';
 return '';
}
