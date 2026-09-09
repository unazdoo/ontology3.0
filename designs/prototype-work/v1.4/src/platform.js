export const embedded =
  new URLSearchParams(globalThis.location?.search || "").get("embedded") ===
    "1" && parent !== window;
export function send(type, payload = {}) {
  if (embedded) parent.postMessage({ type, ...payload }, location.origin);
}
export function native(moduleId, taskId, scope) {
  send("OFW_V14_NATIVE", { moduleId, taskId, scope });
}
export function canonicalScope(context, data) {
  const resolve = (id) =>
    data.enterprises.find(
      (row) =>
        row.id === id ||
        row.id === String(id).replace(/^S003-/, "") ||
        row.aliasNames.includes(id),
    )?.id;
  const hasScope = Array.isArray(context?.objectSetRef?.objectIds);
  const raw = context?.objectSetRef?.objectIds || [],
    selectedId = resolve(context?.activeObjectRef?.id);
  const objectIds = [...new Set(raw.map(resolve).filter(Boolean))];
  return {
    objectIds: hasScope
      ? objectIds
      : selectedId
        ? [selectedId]
        : context?.activeObjectRef
          ? []
          : null,
    selectedId: selectedId || null,
    unsupportedCount: raw.filter((id) => !resolve(id)).length,
  };
}
