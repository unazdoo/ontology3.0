"use strict";

class ReportError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "ReportError";
    this.code = code;
    this.details = details || null;
  }
}

function fail(code, message, details) {
  throw new ReportError(code, message, details);
}

module.exports = Object.freeze({ ReportError, fail });
