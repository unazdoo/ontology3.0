#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { Pool } from 'pg';

const require = createRequire(import.meta.url);
const runtime = require('../../../infra/runtime');
const deployment = require('../../../infra/runtime/deployment-control');

function parse(argv) {
  const result = { receipt: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--receipt') result.receipt = argv[++index];
    else if (value === '--pr-schema') result.prSchema = argv[++index];
    else if (value === '--help' || value === '-h') result.help = true;
    else throw new Error(`unknown option: ${value}`);
  }
  return result;
}

function usage() {
  console.error('Usage: node rollback-probe.mjs --receipt <path> [--pr-schema <PR_DB_SCHEMA>]');
}

async function implementationReadProbe(pool, prSchema) {
  let recovered = 0;
  for (const moduleId of deployment.MODULE_IDS || ['M01', 'M02', 'M03', 'M04', 'M05', 'M06']) {
    const schema = `${prSchema}_${moduleId.toLowerCase()}`;
    const selected = await pool.query(
      `SELECT scenario_id, scenario_version, scenario_run_id, scenario_formed_at,
              scenario_status, aggregate_id
         FROM "${schema}".aggregate_state
        ORDER BY scenario_id, scenario_version, scenario_run_id, aggregate_id LIMIT 1`
    );
    const row = selected.rows[0];
    if (!row) continue;
    const store = runtime.createPostgresModuleStore({ client: pool, prSchema, moduleId });
    const value = await store.hydrate({
      ownerModule: moduleId,
      aggregateId: row.aggregate_id,
      scenarioContext: {
        scenarioId: row.scenario_id,
        scenarioVersion: row.scenario_version,
        scenarioRunId: row.scenario_run_id,
        formedAt: new Date(row.scenario_formed_at).toISOString(),
        status: row.scenario_status
      }
    });
    if (value) recovered += 1;
  }
  return { ok: recovered > 0, recoveredModuleCount: recovered };
}

try {
  const options = parse(process.argv.slice(2));
  if (options.help) { usage(); process.exit(0); }
  if (!options.receipt) throw new Error('--receipt is required');
  if (process.env.OFW_REAL_ENVIRONMENT !== '1') throw new Error('OFW_REAL_ENVIRONMENT=1 is required for a production-evidence rollback probe');
  if (!process.env.PR_DATABASE_URL) throw new Error('PR_DATABASE_URL is required');
  const prSchema = options.prSchema || process.env.PR_DB_SCHEMA;
  const pool = new Pool({ connectionString: process.env.PR_DATABASE_URL, max: 4 });
  try {
    const control = deployment.createPostgresDeploymentControl({ client: pool, prSchema });
    await control.install({ initialVersion: deployment.ACTIVE_VERSION, initialMode: 'enabled', actorRef: 'platform-release-owner' });
    const receipt = await deployment.runRollbackProbe({
      control,
      productionEvidence: true,
      evidence: `artifact://${path.basename(options.receipt)}`,
      readProbe: () => implementationReadProbe(pool, prSchema)
    });
    const output = path.resolve(options.receipt);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    console.log(`Rollback probe verified: ${receipt.sourceVersion} -> ${receipt.targetVersion} -> ${receipt.restoredVersion}`);
  } finally {
    await pool.end();
  }
} catch (error) {
  console.error(`Rollback probe FAILED: ${error.message}`);
  usage();
  process.exit(1);
}
