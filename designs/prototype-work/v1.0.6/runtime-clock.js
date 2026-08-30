(function installS001RuntimeClock(global) {
  "use strict";

  const CLOCK_KEY = "__ONTOLOGY3_RUNTIME_CLOCK__";
  const CLOCK_VERSION = "s001-v1.0.4-20260815-utc";
  const OFFSET_MS = 0;

  if (global[CLOCK_KEY]?.version === CLOCK_VERSION) return;

  const NativeDate = global.Date;
  const nativeNow = NativeDate.now.bind(NativeDate);
  const virtualNow = () => nativeNow() + OFFSET_MS;

  function RuntimeDate(...args) {
    if (!new.target) return new NativeDate(virtualNow()).toString();
    return Reflect.construct(NativeDate, args.length ? args : [virtualNow()], new.target);
  }

  Object.setPrototypeOf(RuntimeDate, NativeDate);
  RuntimeDate.prototype = Object.create(NativeDate.prototype, {
    constructor: {
      value: RuntimeDate,
      writable: true,
      configurable: true
    }
  });
  Object.defineProperties(RuntimeDate, {
    now: { value: virtualNow, configurable: true },
    parse: { value: NativeDate.parse, configurable: true },
    UTC: { value: NativeDate.UTC, configurable: true }
  });

  global.Date = RuntimeDate;
  Object.defineProperty(global, CLOCK_KEY, {
    value: Object.freeze({
      version: CLOCK_VERSION,
      offsetMs: OFFSET_MS,
      authoritativeDate: "2026-08-15",
      authoritativeTimeZone: "UTC"
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });
})(globalThis);
