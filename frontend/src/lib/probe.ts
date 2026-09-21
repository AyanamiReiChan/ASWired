export const KOMARI_PROVIDER = 'Komari';
export const KOMARI_VERSION = '1.2.5-fix2';
export const KOMARI_RELEASE_URL = 'https://github.com/AyanamiReiChan/ASWired-Release/releases';

export const PROBE_DEFAULTS = {
  probeProvider: KOMARI_PROVIDER,
  probeVersion: KOMARI_VERSION,
  probeBaseUrl: '',
  probeCredentialRef: '',
  komariAutoSync: true,
  probePublicEnabled: false,
  showCPU: true,
  showMemory: true,
  showTraffic: false,
};


export function publicProbePreferences(values: Record<string, unknown> = {}) {
  return {
    enabled: typeof values.probePublicEnabled === 'boolean' ? values.probePublicEnabled : true,
    showCPU: typeof values.showCPU === 'boolean' ? values.showCPU : true,
    showMemory: typeof values.showMemory === 'boolean' ? values.showMemory : true,
    showTraffic: typeof values.showTraffic === 'boolean' ? values.showTraffic : false,
  };
}


export const KOMARI_DEMO_NODES = [
  { id: 'demo-hk', name: '香港 · HKG 01', code: 'HK', status: '在线', cpu: 18, memory: 38, upload: '1.2 MB/s', download: '4.6 MB/s', lastReport: '09-15 10:42' },
  { id: 'demo-jp', name: '东京 · NRT 01', code: 'JP', status: '在线', cpu: 9, memory: 24, upload: '680 KB/s', download: '2.1 MB/s', lastReport: '09-15 10:42' },
  { id: 'demo-sg', name: '新加坡 · SIN 01', code: 'SG', status: '在线', cpu: 26, memory: 42, upload: '960 KB/s', download: '3.4 MB/s', lastReport: '09-15 10:42' },
  { id: 'demo-us', name: '洛杉矶 · LAX 01', code: 'US', status: '数据过期', cpu: null, memory: null, upload: null, download: null, lastReport: '09-15 10:20' },
];
