import {test} from 'node:test';
import assert from 'node:assert/strict';
import {systemUpdateLabel} from '../src/lib/systemUpdates.ts';

test('distinguishes an active target version from a verified complete upgrade', () => {
 assert.equal(systemUpdateLabel('failed','v1.0.5','v1.0.5'),'版本已更新，升级检查未通过');
 assert.equal(systemUpdateLabel('failed','v1.0.6','v1.0.5'),'升级失败');
 assert.equal(systemUpdateLabel('failed',undefined,'v1.0.5'),'升级失败');
 assert.equal(systemUpdateLabel('updating','v1.0.5','v1.0.5'),'升级进行中');
 assert.equal(systemUpdateLabel('completed','v1.0.5','v1.0.5'),'升级完成');
});
