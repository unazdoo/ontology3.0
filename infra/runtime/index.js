'use strict';

const common = require('./common');
const postgres = require('./postgres-runtime-persistence');
const deploymentControl = require('./deployment-control');

module.exports = Object.freeze({
  ...common,
  ...postgres,
  ...deploymentControl,
  common,
  postgres,
  deploymentControl
});
