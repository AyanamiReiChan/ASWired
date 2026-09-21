type Selection = { id: string; format: string; url: string; template?: string };
type Output = { url: string; loading: boolean; ready: boolean; config: string; qr: string; error: string; qrError: string };

export function createSubscriptionOutput(readConfig: (path: string) => Promise<string>, createQR: (url: string) => Promise<string>) {
  const empty = (): Output => ({ url: '', loading: false, ready: false, config: '', qr: '', error: '', qrError: '' });
  let state = $state<Output>(empty());
  let generation = 0;

  function clear() {
    generation++;
    state = empty();
  }

  async function load(selection: Selection) {
    const request = ++generation;
    const { id, format, url } = selection;
    state = { ...empty(), url, loading: true };
    try {
      const config = await readConfig(`/api/subscriptions/${encodeURIComponent(id)}/config?format=${encodeURIComponent(format)}${selection.template?'&template='+encodeURIComponent(selection.template):''}`);
      if (request !== generation) return;
      if (!config.trim()) throw new Error('当前格式没有可用配置');
      state.config = config;
      try {
        const qr = await createQR(url);
        if (request !== generation) return;
        state.qr = qr;
      } catch {
        if (request !== generation) return;
        state.qrError = '二维码生成失败，请复制订阅链接';
      }
      state.ready = true;
    } catch (cause) {
      if (request !== generation) return;
      state.error = cause instanceof Error ? cause.message : '配置检查失败，请重试';
    } finally {
      if (request === generation) state.loading = false;
    }
  }

  return { get state() { return state; }, load, clear };
}
