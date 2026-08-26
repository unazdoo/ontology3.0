#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE_IDS = Object.freeze(['M01', 'M02', 'M03', 'M04', 'M05', 'M06']);
const PR_SCHEMA_RE = /^pr_[1-9][0-9]*_[a-f0-9]{7,40}$/;

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertPrSchema(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!PR_SCHEMA_RE.test(normalized)) throw new Error('prSchema must match pr_<number>_<sha7-40>');
  return normalized;
}

function moduleSchema(prSchema, moduleId) {
  return `${assertPrSchema(prSchema)}_${moduleId.toLowerCase()}`;
}

function templateFor(direction) {
  if (!['up', 'down'].includes(direction)) throw new Error('migration direction must be up or down');
  return fs.readFileSync(path.join(HERE, 'migrations', `002_runtime_persistence.${direction}.sql`), 'utf8');
}

function withoutTransaction(sql) {
  return sql.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '').trim();
}

function renderRuntimeMigration(direction, prSchemaValue) {
  const prSchema = assertPrSchema(prSchemaValue);
  const template = templateFor(direction);
  const digestOf = (migrationTemplate) => sha256(migrationTemplate.replaceAll('{{MIGRATION_DIGEST}}', '<migration-digest>'));
  const migrationDigests = Object.freeze({ up: digestOf(templateFor('up')), down: digestOf(templateFor('down')) });
  const migrationDigest = migrationDigests[direction];
  const moduleIds = direction === 'down' ? [...MODULE_IDS].reverse() : MODULE_IDS;
  const bodies = moduleIds.map((moduleId) => withoutTransaction(template
    .replaceAll('{{PR_SCHEMA}}', prSchema)
    .replaceAll('{{MODULE_SCHEMA}}', `"${moduleSchema(prSchema, moduleId)}"`)
    .replaceAll('{{MODULE_ID}}', moduleId)
    .replaceAll('{{MIGRATION_DIGEST}}', migrationDigest)));
  return {
    direction,
    prSchema,
    migrationId: '002_runtime_persistence',
    migrationDigest,
    migrationDigests,
    modules: moduleIds.map((moduleId) => ({ moduleId, schemaName: moduleSchema(prSchema, moduleId) })),
    sql: `BEGIN;\n\n${bodies.join('\n\n')}\n\nCOMMIT;\n`
  };
}

function pgEnvironment(source = process.env) {
  const mapping = {
    PGHOST: source.PR_PGHOST,
    PGPORT: source.PR_PGPORT || '5432',
    PGDATABASE: source.PR_PGDATABASE,
    PGUSER: source.PR_PGUSER,
    PGPASSWORD: source.PR_PGPASSWORD,
    PGSSLMODE: source.PR_PGSSLMODE || 'disable'
  };
  for (const field of ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
    if (!mapping[field]) throw new Error(`${field.replace('PG', 'PR_PG')} is required`);
  }
  return { ...source, ...mapping };
}

function writeReceipt(filePath, value) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function evidenceMetadata(options, rendered) {
  const source = options.env || process.env;
  const pullRequestNumber = String(options.pullRequestNumber || source.PR_NUMBER || '');
  const headSha = String(options.headSha || source.HEAD_SHA || '').toLowerCase();
  const environmentId = String(options.environmentId || source.PR_ENVIRONMENT_ID || '');
  const implementationRoundId = String(options.implementationRoundId || source.IMPLEMENTATION_ROUND_ID || '');
  if (!/^[1-9][0-9]{0,8}$/.test(pullRequestNumber)) throw new Error('PR_NUMBER is required and must be a positive integer');
  if (!/^[a-f0-9]{7,64}$/.test(headSha)) throw new Error('HEAD_SHA is required and must be a hexadecimal commit SHA');
  const shortSha = headSha.slice(0, 12);
  const expectedSchema = `pr_${pullRequestNumber}_${shortSha}`;
  const expectedEnvironmentId = `pr-${pullRequestNumber}-${shortSha}`;
  if (rendered.prSchema !== expectedSchema) throw new Error(`prSchema must equal ${expectedSchema} for this PR/head`);
  if (environmentId !== expectedEnvironmentId) throw new Error(`PR_ENVIRONMENT_ID must equal ${expectedEnvironmentId}`);
  if (!implementationRoundId) throw new Error('IMPLEMENTATION_ROUND_ID is required');
  const receiptId = String(options.receiptId || source.MIGRATION_RECEIPT_ID
    || `MIG-${rendered.direction}-${environmentId}-${rendered.migrationDigest.slice(0, 12)}`);
  if (!receiptId.trim()) throw new Error('migration receiptId must be non-empty');
  return {
    receiptId,
    pullRequest: { number: Number(pullRequestNumber), headSha },
    environmentId,
    implementationRoundId,
    commitSha: headSha
  };
}

function runRuntimeMigration(options) {
  const rendered = renderRuntimeMigration(options.direction, options.prSchema);
  if (rendered.direction === 'down' && options.allowIsolatedDown !== true) {
    throw new Error('down migration requires ALLOW_ISOLATED_RUNTIME_DOWN=1');
  }
  if (options.dryRun === true) {
    return {
      schemaVersion: 'ofw.runtime-persistence-migration-receipt.v1',
      status: 'dry-run',
      productionEvidence: false,
      ...rendered,
      sql: rendered.sql,
      formedAt: new Date().toISOString()
    };
  }
  if (!options.receipt) throw new Error('--receipt is required for an applied migration');
  const metadata = evidenceMetadata(options, rendered);
  const spawn = options.spawnSync || spawnSync;
  const result = spawn(options.psqlPath || 'psql', ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', '-'], {
    input: rendered.sql,
    encoding: 'utf8',
    env: pgEnvironment(options.env || process.env),
    maxBuffer: 10 * 1024 * 1024
  });
  const receipt = {
    schemaVersion: 'ofw.runtime-persistence-migration-receipt.v1',
    ...metadata,
    status: result.status === 0 ? 'applied' : 'failed',
    qualityStatus: result.status === 0 ? 'verified' : 'failed',
    productionEvidence: true,
    direction: rendered.direction,
    prSchema: rendered.prSchema,
    migrationId: rendered.migrationId,
    migrationDigest: rendered.migrationDigest,
    modules: rendered.modules,
    up: rendered.direction === 'up'
      ? `applied:${rendered.migrationId}@${rendered.migrationDigests.up}`
      : `retained:${rendered.migrationId}@${rendered.migrationDigests.up}`,
    down: rendered.direction === 'down'
      ? `applied:${rendered.migrationId}@${rendered.migrationDigests.down}`
      : `available:infra/migrations/002_runtime_persistence.down.sql@${rendered.migrationDigests.down}`,
    evidence: `artifact://${path.basename(options.receipt)}`,
    command: 'psql --no-psqlrc --set ON_ERROR_STOP=1 --file -',
    exitCode: result.status,
    signal: result.signal || null,
    stdout: String(result.stdout || '').slice(-20000),
    stderr: String(result.stderr || '').slice(-20000),
    credentialsPersisted: false,
    formedAt: new Date().toISOString()
  };
  writeReceipt(options.receipt, receipt);
  if (result.status !== 0) {
    const error = new Error(`runtime persistence ${rendered.direction} migration failed`);
    error.receipt = receipt;
    throw error;
  }
  return receipt;
}

function parseArgs(argv) {
  const options = { direction: argv[0], receipt: null, dryRun: false };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--pr-schema') options.prSchema = argv[++index];
    else if (value === '--receipt') options.receipt = argv[++index];
    else if (value === '--receipt-id') options.receiptId = argv[++index];
    else if (value === '--pr-number') options.pullRequestNumber = argv[++index];
    else if (value === '--head-sha') options.headSha = argv[++index];
    else if (value === '--environment-id') options.environmentId = argv[++index];
    else if (value === '--implementation-round-id') options.implementationRoundId = argv[++index];
    else if (value === '--dry-run') options.dryRun = true;
    else if (value === '--help' || value === '-h') options.help = true;
    else throw new Error(`unknown option: ${value}`);
  }
  return options;
}

function usage() {
  console.error(`Usage: node infra/migrate-runtime.mjs <up|down> --pr-schema <pr_number_sha> [options]

Environment (values are never written to receipts):
  PR_PGHOST PR_PGPORT PR_PGDATABASE PR_PGUSER PR_PGPASSWORD [PR_PGSSLMODE]
  PR_NUMBER HEAD_SHA PR_ENVIRONMENT_ID IMPLEMENTATION_ROUND_ID [MIGRATION_RECEIPT_ID]

Options:
  --receipt <path>  Write a redacted migration receipt
  --receipt-id <id> Override the deterministic migration receipt ID
  --dry-run         Render and validate SQL without invoking psql

Down migration additionally requires ALLOW_ISOLATED_RUNTIME_DOWN=1.`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) { usage(); process.exit(0); }
    options.allowIsolatedDown = process.env.ALLOW_ISOLATED_RUNTIME_DOWN === '1';
    const receipt = runRuntimeMigration(options);
    if (options.dryRun) process.stdout.write(receipt.sql);
    else console.log(`runtime persistence ${receipt.direction} migration ${receipt.status}: ${receipt.prSchema}`);
  } catch (error) {
    console.error(`Runtime persistence migration FAILED: ${error.message}`);
    usage();
    process.exit(1);
  }
}

export {
  MODULE_IDS,
  PR_SCHEMA_RE,
  assertPrSchema,
  moduleSchema,
  renderRuntimeMigration,
  pgEnvironment,
  runRuntimeMigration
};
