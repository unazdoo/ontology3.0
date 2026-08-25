'use strict';

const descriptor = require('./RELEASE.json');
const deployment = require('../../../infra/runtime/deployment-control');

module.exports = Object.freeze({
  descriptor: Object.freeze(descriptor),
  version: descriptor.version,
  deploymentMode: descriptor.deploymentMode,
  ...deployment
});
