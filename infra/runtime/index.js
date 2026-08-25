'use strict';

const common = require('./common');
const postgres = require('./postgres-runtime-persistence');

module.exports = Object.freeze({ ...common, ...postgres, common, postgres });
