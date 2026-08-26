'use strict';

class QueryServiceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'QueryServiceError';
    this.code = code;
    this.details = details === undefined ? null : details;
  }
}

function fail(code, message, details) {
  throw new QueryServiceError(code, message, details);
}

module.exports = Object.freeze({ QueryServiceError, fail });
