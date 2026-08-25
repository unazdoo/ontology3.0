'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const release = require('./index');

test('implementation-0.0.0 is a disabled Foundation-only rollback target', () => {
  assert.equal(release.version, 'implementation-0.0.0');
  assert.equal(release.deploymentMode, 'disabled');
  assert.equal(release.descriptor.foundationOnly, true);
  assert.equal(release.descriptor.capabilities.health, 'enabled');
  assert.equal(release.descriptor.capabilities.readOnlyAudit, 'enabled');
  assert.equal(release.descriptor.capabilities.businessWrite, 'disabled');
  assert.equal(release.descriptor.capabilities.consumerDispatch, 'disabled');
  assert.equal(release.descriptor.rollbackPolicy.downMigrationAllowed, false);
  assert.equal(release.descriptor.rollbackPolicy.historyDeletionAllowed, false);
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  assert.match(readme, /never runs a down migration/);
});
