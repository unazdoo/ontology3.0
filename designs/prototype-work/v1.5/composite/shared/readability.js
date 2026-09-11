(function installReadability(global) {
  "use strict";

  const documents = new WeakMap();

  function minimumFor(selector = "") {
    if (/\.architecture-node|\.node-en|\.node-scope/.test(selector)) return 11;
    if (/(?:^|[\s,>+~])(?:code|pre|kbd|svg|text)(?=[.#:\s,>+~\[]|$)|mono|\.axis|\.tick/.test(selector)) return 12;
    if (/\bh1\b/.test(selector)) return 20;
    if (/\bh2\b/.test(selector)) return 16;
    if (/\bh3\b|\bbody\b/.test(selector)) return 14;
    return 13;
  }

  function raiseFont(style, minimum) {
    const size = style.getPropertyValue("font-size").trim();
    if (!size || /^(inherit|initial|unset|revert|revert-layer)$/.test(size)) return;
    if (size.startsWith(`max(${minimum}px,`)) return;
    const px = /^(\d+(?:\.\d+)?)px$/.exec(size);
    if (px && Number(px[1]) === 0) return;
    if (px && Number(px[1]) >= minimum) return;
    style.setProperty("font-size", `max(${minimum}px, ${size})`, style.getPropertyPriority("font-size"));
    const leading = /^(\d+(?:\.\d+)?)px$/.exec(style.getPropertyValue("line-height"));
    if (leading && Number(leading[1]) < minimum) style.setProperty("line-height", "1.4", style.getPropertyPriority("line-height"));
  }

  function upgradeRules(rules) {
    for (const rule of rules) {
      if (rule.style && rule.selectorText) raiseFont(rule.style, minimumFor(rule.selectorText));
      if (rule.cssRules) upgradeRules(rule.cssRules);
    }
  }

  function refresh(doc) {
    if (!doc?.body?.isConnected) return;
    let sheets = documents.get(doc);
    if (!sheets) { sheets = new WeakSet(); documents.set(doc, sheets); }
    // Adjust only the live document's CSSOM; frozen stylesheets on disk stay untouched.
    for (const sheet of doc.styleSheets) {
      if (sheets.has(sheet)) continue;
      try { upgradeRules(sheet.cssRules); sheets.add(sheet); } catch (_) { /* Cross-origin sheets remain owned by their source. */ }
    }
    for (const element of doc.querySelectorAll('[style*="font"]')) {
      if (element.namespaceURI === "http://www.w3.org/1999/xhtml") raiseFont(element.style, minimumFor(element.tagName.toLowerCase()));
    }
  }

  function install(doc, moduleId = "shell") {
    doc.documentElement.dataset.ofwModule = moduleId;
    const update = () => refresh(doc);
    doc.defaultView.__OFW_REFRESH_LAYOUT__ = update;
    doc.addEventListener("load", (event) => { if (event.target?.tagName === "LINK") update(); }, true);
    update();
    return update;
  }

  global.OFW_READABILITY = Object.freeze({ install, refresh, minimumFor });
})(window);
