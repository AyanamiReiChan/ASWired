import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/traffic-chart.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { trafficBytes, trafficScale, formatTrafficBytes, buildMinuteTraffic, formatTrafficTime } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('traffic preserves byte precision when reading the API GiB values', () => {
  for (const bytes of [0, 1, 512, 393861, 16 * 1024, 2 * 1024 ** 2, 1024 ** 3, 3 * 1024 ** 4]) {
    assert.equal(trafficBytes(bytes / 1024 ** 3), bytes);
    assert.equal(trafficBytes(String(bytes / 1024 ** 3)), bytes);
  }
  for (const invalid of [null, undefined, '', ' ', true, false, NaN, Infinity, -1, 'invalid', {}]) {
    assert.equal(trafficBytes(invalid), null);
  }
});

test('chart selects a shared axis unit and a readable scale for actual traffic', () => {
  for (const [bytes, unit] of [[512, 'B'], [16 * 1024, 'KB'], [2 * 1024 ** 2, 'MB'], [1024 ** 3, 'GB'], [3 * 1024 ** 4, 'TB']]) {
    const scale = trafficScale([0, bytes / 2, bytes]);
    assert.ok(scale.maximum >= bytes);
    assert.ok(scale.maximum <= bytes * 2);
    assert.equal(new Set(scale.labels).size, 4);
    assert.ok(scale.labels.every(label => label.endsWith(` ${unit}`)));
  }
  const small = trafficScale([393861]);
  assert.deepEqual(small.labels, ['600 KB', '400 KB', '200 KB', '0 KB']);
  assert.equal(formatTrafficBytes(393861), '384.63 KB');
});

test('unit boundaries use the same 1024 basis as the ledger', () => {
  for (const [index, unit] of ['KB', 'MB', 'GB', 'TB'].entries()) {
    const boundary = 1024 ** (index + 1);
    assert.equal(formatTrafficBytes(boundary), `1 ${unit}`);
    assert.ok(trafficScale([boundary]).labels.every(label => label.endsWith(` ${unit}`)));
    assert.ok(!trafficScale([boundary - 1]).labels[0].endsWith(` ${unit}`));
  }
});

test('empty and zero-only samples keep a finite axis without inventing usage', () => {
  for (const values of [[], [0], [0, 0], [NaN, Infinity, -1]]) {
    assert.equal(trafficScale(values).maximum, 3);
    assert.deepEqual(trafficScale(values).labels, ['3 B', '2 B', '1 B', '0 B']);
  }
  assert.equal(formatTrafficBytes(0), '0 B');
  assert.equal(trafficBytes(0), 0);
});

const minute = 60_000;
const end = Date.parse('2026-09-17T12:00:00+08:00');
const bucket = (at, bytes, gap = false) => ({ at, total: bytes / 1024 ** 3, gap });

test('minute samples are sorted within the API hour window without filling missing buckets', () => {
  const start = end - 59 * minute;
  const to = end + 30_000;
  const chart = buildMinuteTraffic([
    bucket(end, 2048), bucket(start, 0), bucket(end - 29 * minute, 512),
    bucket(start - minute, 100), bucket(to, 100), bucket(end + minute, 100)
  ], '1h', to);
  assert.deepEqual(chart.samples.map(({ at, bytes, x }) => ({ at, bytes, x })), [
    { at: start, bytes: 0, x: 0 },
    { at: end - 29 * minute, bytes: 512, x: 30 / 59.5 * 100 },
    { at: end, bytes: 2048, x: 59 / 59.5 * 100 }
  ]);
  assert.equal(chart.from, start);
  assert.equal(chart.to, to);
  assert.equal(chart.totalBytes, 2560);
  assert.deepEqual(chart.segments.map(segment => segment.length), [3]);
  assert.deepEqual(chart.ticks.map(tick => tick.label), ['11:01', '11:15', '11:30', '11:45', '12:00']);
});

test('minute chart uses actual API bounds and selected one, six, and twenty-four-hour windows', () => {
  for (const [period, hours] of [['1h', 1], ['6h', 6], ['24h', 24]]) {
    const chart = buildMinuteTraffic([bucket(end - minute, 10)], period, end + 30_000, end - 48 * 60 * minute);
    assert.equal(chart.from, end - (hours * 60 - 1) * minute);
    assert.equal(chart.samples[0].x, (hours * 60 - 2) / (hours * 60 - 0.5) * 100);
  }
  const chart = buildMinuteTraffic([bucket(end - 40 * minute, 10), bucket(end - 20 * minute, 20)], '1h', end, end - 40 * minute);
  assert.equal(chart.from, end - 40 * minute);
  assert.deepEqual(chart.samples.map(sample => sample.x), [0, 50]);
  const current = buildMinuteTraffic([bucket(end, 10)], '1h', end + 15_000);
  assert.equal(current.samples.length, 1);
  assert.ok(current.samples[0].x > 99 && current.samples[0].x < 100);
});

test('minute window includes its first aligned bucket and excludes the previous bucket', () => {
  const to = Date.parse('2026-09-17T12:34:56+08:00');
  const first = Date.parse('2026-09-17T11:35:00+08:00');
  const chart = buildMinuteTraffic([
    bucket(first - minute, 1), bucket(first, 2), bucket(Date.parse('2026-09-17T12:34:00+08:00'), 3)
  ], '1h', to, first - 23 * 60 * minute);
  assert.equal(chart.from, first);
  assert.deepEqual(chart.samples.map(sample => sample.bytes), [2, 3]);
  assert.equal(chart.samples[0].x, 0);
  const edge = buildMinuteTraffic([bucket(end, 1), bucket(end + minute, 2)], '1h', end);
  assert.equal(edge.samples.length, 1);
  assert.equal(edge.samples[0].at, end);
  assert.equal(edge.samples[0].x, 100);
});

test('minute chart connects recorded minutes while retaining gap evidence and actual totals', () => {
  const chart = buildMinuteTraffic([
    bucket(end - 9 * minute, 1), bucket(end - 8 * minute, 2),
    bucket(end - 6 * minute, 3), bucket(end - 5 * minute, 4, true),
    bucket(end - 4 * minute, 5), bucket(end - 3 * minute, 6)
  ], '1h', end);
  assert.deepEqual(chart.segments.map(segment => segment.map(sample => sample.bytes)), [[1, 2, 3, 4, 5, 6]]);
  assert.equal(chart.samples[3].gap, true);
  assert.equal(chart.samples.length, 6);
  assert.equal(chart.totalBytes, 21);
});

test('minute chart rejects invalid records while retaining measured zero and small byte values', () => {
  const chart = buildMinuteTraffic([
    null, {}, { at: end - minute, total: null }, bucket(end - 2 * minute, -1),
    bucket(end - 3 * minute + 1, 10), bucket('2026-09-17T11:55:00+08:00', 10),
    bucket(NaN, 1), bucket(Infinity, 1), bucket(end - 4 * minute, 0),
    bucket(end - 5 * minute, 1), bucket(end - 6 * minute, 512)
  ], '1h', end);
  assert.deepEqual(chart.samples.map(sample => sample.bytes), [512, 1, 0]);
  assert.equal(chart.totalBytes, 513);
  assert.ok(chart.scale.labels.every(label => label.endsWith(' B')));
});

test('duplicate minute buckets do not double-count totals or erase gap evidence', () => {
  const chart = buildMinuteTraffic([
    bucket(end - 2 * minute, 1, true), bucket(end - minute, 2), bucket(end - 2 * minute, 3),
    { at: end - 2 * minute, total: null }
  ], '1h', end);
  assert.deepEqual(chart.samples.map(sample => sample.bytes), [3, 2]);
  assert.equal(chart.samples[0].gap, true);
  assert.equal(chart.totalBytes, 5);
  assert.equal(chart.segments.length, 1);
});

test('minute chart does not invent samples for empty or unavailable history', () => {
  for (const rows of [[], null, undefined, {}]) {
    const chart = buildMinuteTraffic(rows, '1h', end);
    assert.deepEqual(chart.samples, []);
    assert.deepEqual(chart.segments, []);
    assert.equal(chart.totalBytes, 0);
    assert.equal(chart.scale.maximum, 3);
  }
  for (const to of [null, undefined, NaN, Infinity, -1, 0]) {
    const chart = buildMinuteTraffic([bucket(end - minute, 1)], '1h', to);
    assert.equal(chart.from, null);
    assert.equal(chart.to, null);
    assert.deepEqual(chart.samples, []);
    assert.deepEqual(chart.ticks, []);
  }
  const invalidWindow = buildMinuteTraffic([bucket(end - minute, 1)], '1h', end, end + minute);
  assert.deepEqual(invalidWindow.samples, []);
  assert.deepEqual(invalidWindow.ticks, []);
  const zero = buildMinuteTraffic([bucket(end - minute, 0)], '1h', end);
  assert.equal(zero.samples.length, 1);
  assert.equal(zero.segments[0].length, 1);
  assert.equal(zero.scale.maximum, 3);
  const singleInstant = buildMinuteTraffic([bucket(end, 1)], '1h', end, end);
  assert.equal(singleInstant.samples[0].x, 50);
  assert.deepEqual(singleInstant.ticks, [{ at: end, x: 50, label: '12:00' }]);
});

test('minute labels use ledger timezone consistently across midnight', () => {
  assert.equal(formatTrafficTime(Date.parse('2026-09-16T16:00:00Z')), '00:00');
  assert.equal(formatTrafficTime(Date.parse('2026-09-16T16:01:00Z')), '00:01');
  assert.equal(formatTrafficTime(Date.parse('2026-09-16T16:01:00Z'), true), '2026-09-17 00:01');
  assert.equal(formatTrafficTime(NaN), '');
});
