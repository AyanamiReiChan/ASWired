export function certificateDomains(input: string, includeWildcard = false): string[] {
 const domains = input.split(/[\s,，]+/).map(value => value.trim().toLowerCase().replace(/\.$/, '')).filter(Boolean);
 return [...new Set(domains.flatMap(domain => {
  if (!includeWildcard) return [domain];
  const base = domain.startsWith('*.') ? domain.slice(2) : domain;
  return [base, '*.' + base];
 }))];
}

export function websiteTargetName(id: string): string {
 return id === 'panel' ? '主控网站' : id === 'komari' ? 'Komari' : id;
}

export function websiteCertificateStatus(site: Record<string, any>) {
 if (site.status === 'valid' && site.verified) return {label:'有效',kind:'success'};
 if (site.status === 'expiring' && site.verified) return {label:'即将到期',kind:'warning'};
 if (site.status === 'invalid') return {label:'验证失败',kind:'danger'};
 return {label:site.status === 'http' ? '未启用 HTTPS' : site.status === 'unconfigured' ? '未配置' : '检查失败',kind:'warning'};
}
