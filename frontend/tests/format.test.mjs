import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/format.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { formatNumber, formatDisplayValue, formatUsagePercent } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('numeric display rounds at two decimals without trailing or negative zeros', () => {
  for (const [value, expected] of [
    [6020.898382493912, '6020.9'], [13.422004622886455, '13.42'],
    [1.005, '1.01'], [9.999, '10'], [-12.345, '-12.35'],
    [-0.0004, '0'], [0.0004, '0'], [0, '0'], [443, '443'],
    [123456.7, '123456.7'], [' 6020.898382493912 ', '6020.9'], ['1.2345e2', '123.45']
  ]) assert.equal(formatNumber(value), expected);
});

test('missing or nonnumeric metrics never become zero', () => {
  for (const value of [null, undefined, '', ' ', true, false, {}, [], NaN, Infinity, -Infinity, 'NaN', '0xff', '192.0.2.10']) {
    assert.equal(formatNumber(value), '—');
  }
  assert.equal(formatUsagePercent(null), '未知');
  assert.equal(formatUsagePercent(NaN), '未知');
  assert.equal(formatUsagePercent(0), '0%');
  assert.equal(formatUsagePercent(12.345), '12.35%');
});

test('generic details preserve text identifiers, versions and configuration', () => {
  for (const value of ['001234', '1.2345', 'v0.2.0-test.9da5bfd', '192.0.2.10', '{"speed":6020.898382493912}']) {
    assert.equal(formatDisplayValue(value), value);
  }
  assert.equal(formatDisplayValue(6020.898382493912), '6020.9');
  assert.equal(formatDisplayValue(null), '—');
  assert.equal(formatDisplayValue(false), 'false');
});
