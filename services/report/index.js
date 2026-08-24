"use strict";

// M06's domain implementation lives in packages/report so the same contract
// helpers can be used by workers and the module service. This is the service
// Owner entry point prescribed by the implementation workspace architecture.
module.exports = require("../../packages/report");
