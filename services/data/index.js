'use strict';

const runtime = require('./runtime');
const contracts = require('./contracts');
const clients = require('./clients');
const envelope = require('./envelope');
const checkpoint = require('./checkpoint');
const schema = require('./schemas/m02-data-contracts.schema.json');
const schemaRegistry = require('./schemas/registry.json');

module.exports = Object.freeze({
  ...runtime,
  ...contracts,
  ...clients,
  ...envelope,
  ...checkpoint,
  runtime,
  contracts,
  clients,
  envelope,
  checkpoint,
  schema,
  schemaRegistry,
  schemas: Object.freeze({ data: schema, registry: schemaRegistry }),
  createDataSpine: runtime.createDataRuntime,
  createM02Runtime: runtime.createDataRuntime,
  DataSpine: runtime.DataPipelineRuntime
});
