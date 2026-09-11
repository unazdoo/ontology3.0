export function idleProjection(source, moduleId) {
  if (moduleId === 'ontology') {
    const original = 'if (formalLabel?.nextElementSibling && published) formalLabel.nextElementSibling.textContent = published;';
    if (!source.includes(original)) throw new Error('Ontology projection changed');
    return source.replace(original, 'if (formalLabel?.nextElementSibling && published && formalLabel.nextElementSibling.textContent !== published) formalLabel.nextElementSibling.textContent = published;');
  }
  if (moduleId === 'data') {
    const original = 'window.setInterval(schedule, 360);';
    if (!source.includes(original)) throw new Error('Data projection changed');
    // Attribute decoration does not trigger this observer; only new page content does.
    return source.replace(original, 'const observer = new MutationObserver(schedule); observer.observe(document.body, {childList:true,subtree:true}); addEventListener("pagehide", () => observer.disconnect(), {once:true});');
  }
  return source;
}
