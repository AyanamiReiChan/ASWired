import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/log-date-range.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { beijingDate, logDateRangeError, sameLogDateRange } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('log date defaults follow the Beijing day at midnight and year boundaries', () => {
  assert.equal(beijingDate(new Date('2026-09-17T15:59:59Z')), '2026-09-17');
  assert.equal(beijingDate(new Date('2026-09-17T16:00:00Z')), '2026-09-18');
  assert.equal(beijingDate(new Date('2026-12-31T16:00:00Z')), '2027-01-01');
});

test('log deletion accepts a single day and leap dates but rejects impossible or reversed ranges', () => {
  assert.equal(logDateRangeError({ startDate: '2024-02-29', endDate: '2024-02-29' }), '');
  assert.equal(logDateRangeError({ startDate: '2026-09-16', endDate: '2026-09-17' }), '');
  for (const [startDate, endDate] of [['', '2026-09-17'], ['2026-09-18', '2026-09-17'], ['2026-02-29', '2026-03-01'], ['2026-02-30', '2026-03-01'], ['2026-9-1', '2026-09-17']]) {
    assert.notEqual(logDateRangeError({ startDate, endDate }), '');
  }
});

test('a deletion preview cannot be reused for a different date range', () => {
  const preview = { startDate: '2026-09-16', endDate: '2026-09-17' };
  assert.equal(sameLogDateRange(preview, { ...preview }), true);
  assert.equal(sameLogDateRange(preview, { ...preview, startDate: '2026-09-15' }), false);
  assert.equal(sameLogDateRange(preview, { ...preview, endDate: '2026-09-18' }), false);
});
