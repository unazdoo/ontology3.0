import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertPrSchema,
  renderRuntimeMigration,
  pgEnvironment,
  runRuntimeMigration
} from './migrate-runtime.mjs';

const SHA = '3a4da92ac01c4ea80764778478894738a0826fa7';
const ENV = Object.freeze({
  PR_PGHOST: '127.0.0.1', PR_PGPORT: '5432', PR_PGDATABASE: 'ofw',
  PR_PGUSER: 'pr-user', PR_PGPASSWORD: 'short-lived-secret',
  PR_NUMBER: '4', HEAD_SHA: SHA, PR_ENVIRONMENT_ID: 'pr-4-3a4da92ac01c',
  IMPLEMENTATION_ROUND_ID: 'IMPL-ROUND-S001-001'
});

test('up migration renders six owner schemas in one transaction without unresolved tokens', () => {
  const value = renderRuntimeMigration('up', 'pr_4_3a4da92ac01c');
  assert.equal(value.modules.length, 6);
  assert.equal(value.modules[0].schemaName, 'pr_4_3a4da92ac01c_m01');
  assert.equal(value.modules[5].schemaName, 'pr_4_3a4da92ac01c_m06');
  assert.equal(value.sql.trim().startsWith('BEGIN;'), true);
  assert.equal(value.sql.trim().endsWith('COMMIT;'), true);
  assert.doesNotMatch(value.sql, /{{[^}]+}}/);
  assert.match(value.sql, /owner_operations/);
  assert.match(value.sql, /owner_operations_guard/);
  for (const moduleId of ['M01', 'M02', 'M03', 'M04', 'M05', 'M06']) assert.match(value.sql, new RegExp(`module_owner = '${moduleId}'`));
});

test('down migration reverses module order and cannot target a non-PR namespace', () => {
  const value = renderRuntimeMigration('down', 'pr_4_3a4da92ac01c');
  assert.equal(value.modules[0].moduleId, 'M06');
  assert.equal(value.modules[5].moduleId, 'M01');
  assert.match(value.sql, /restricted to isolated PR schemas/);
  assert.throws(() => assertPrSchema('main'), /prSchema/);
  assert.throws(() => runRuntimeMigration({ direction: 'down', prSchema: 'pr_4_3a4da92ac01c', dryRun: true }), /ALLOW_ISOLATED_RUNTIME_DOWN/);
});

test('PG mapping keeps secrets in child environment only', () => {
  const mapped = pgEnvironment(ENV);
  assert.equal(mapped.PGHOST, ENV.PR_PGHOST);
  assert.equal(mapped.PGPASSWORD, ENV.PR_PGPASSWORD);
  assert.throws(() => pgEnvironment({}), /PR_PGHOST/);
});

test('applied receipt is strictly bound to PR, head, environment and implementation round', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ofw-migration-test-'));
  const receiptPath = path.join(directory, 'migration-up.json');
  let invocation;
  const receipt = runRuntimeMigration({
    direction: 'up', prSchema: 'pr_4_3a4da92ac01c', receipt: receiptPath, env: ENV,
    spawnSync(command, args, options) {
      invocation = { command, args, options };
      return { status: 0, signal: null, stdout: 'applied', stderr: '' };
    }
  });
  assert.equal(receipt.productionEvidence, true);
  assert.equal(receipt.pullRequest.number, 4);
  assert.equal(receipt.pullRequest.headSha, SHA);
  assert.equal(receipt.environmentId, ENV.PR_ENVIRONMENT_ID);
  assert.equal(receipt.implementationRoundId, ENV.IMPLEMENTATION_ROUND_ID);
  assert.match(receipt.up, /^applied:/);
  assert.match(receipt.down, /^available:/);
  assert.equal(receipt.evidence, 'artifact://migration-up.json');
  assert.equal(invocation.options.env.PGPASSWORD, ENV.PR_PGPASSWORD);
  assert.doesNotMatch(JSON.stringify(receipt), /short-lived-secret/);
  assert.deepEqual(JSON.parse(fs.readFileSync(receiptPath, 'utf8')), receipt);
});

test('applied migration rejects mismatched PR bindings before psql', () => {
  assert.throws(() => runRuntimeMigration({
    direction: 'up', prSchema: 'pr_5_3a4da92ac01c', receipt: '/tmp/not-written.json', env: ENV,
    spawnSync() { throw new Error('must not execute'); }
  }), /prSchema must equal/);
});
