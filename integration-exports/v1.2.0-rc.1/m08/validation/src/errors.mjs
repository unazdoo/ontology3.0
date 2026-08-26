export class ContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ContractError";
    this.code = code;
    this.details = details;
  }
}

export function assertContract(condition, code, message, details = {}) {
  if (!condition) {
    throw new ContractError(code, message, details);
  }
}
