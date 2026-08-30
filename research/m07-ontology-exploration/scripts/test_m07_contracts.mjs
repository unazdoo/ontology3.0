import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const defaultResourceUrl = new URL("../../../designs/m07-ontology-exploration-research/resources/s005-validation.json", import.meta.url);
const resourcePath = process.argv[2] || defaultResourceUrl;
const resource = JSON.parse(fs.readFileSync(resourcePath, "utf8"));
const coreUrl = new URL("../../../designs/m07-ontology-exploration-research/core.js", import.meta.url);
const coreSource = fs.readFileSync(coreUrl, "utf8");
const context = { window: {}, console };
vm.runInNewContext(coreSource, context, { filename: "core.js" });
const core = context.window.M07Core;

const rootObject = resource.objects.find((item) => item.objectTypeId.includes("financing-entity"))
  || resource.objects.find((item) => item.objectTypeId.includes("financial-product"))
  || resource.objects[0];
const rootId = rootObject.id;
const analyst = { roleId: "m07.analyst", currentObjectId: rootId, graphHops: 2, graphQuality: ["passed", "warning", "blocked"] };
const restricted = { roleId: "m07.restricted", currentObjectId: rootId, graphHops: 2, graphQuality: ["passed", "warning", "blocked"] };

const analystLinks = core.visibleLinksForObject(resource, rootId, analyst.roleId);
const restrictedLinks = core.visibleLinksForObject(resource, rootId, restricted.roleId);
assert.ok(analystLinks.length >= restrictedLinks.length, "restricted role never sees more links than analyst");
assert.ok(restrictedLinks.every((link) => core.isAllowed(core.objectById(resource, link.from), restricted.roleId) && core.isAllowed(core.objectById(resource, link.to), restricted.roleId)), "restricted links have authorized endpoints");
assert.ok(restrictedLinks.every((link) => core.isLinkAllowed(link, restricted.roleId)), "restricted links are authorized independently of their endpoints");

const analystGraph = core.graphSlice(resource, analyst);
const restrictedGraph = core.graphSlice(resource, restricted);
assert.ok(analystGraph.nodes.some((node) => node.id === rootId), "analyst graph includes the root object");
assert.ok(restrictedGraph.nodes.every((node) => core.isAllowed(node, restricted.roleId)), "restricted graph removes unauthorized nodes");
assert.ok(restrictedGraph.links.every((link) => core.isLinkAllowed(link, restricted.roleId)), "restricted graph removes unauthorized links");
assert.ok(!analystGraph.nodes.some((node) => node.technicalFixture), "business graph excludes research fixtures");

const capped = core.graphSlice(resource, { ...analyst, graphNodeCap: 2, graphEdgeCap: 1 });
assert.equal(capped.nodeCap, 2);
assert.equal(capped.edgeCap, 1);
assert.equal(capped.truncated, true, "graph cap is explicit");
const unauthorizedRoot = resource.objects.find((item) => !core.isAllowed(item, restricted.roleId));
assert.equal(core.graphSlice(resource, { ...restricted, currentObjectId: unauthorizedRoot?.id || "__missing__" }).nodes.length, 0, "unauthorized root fails closed");

const fixtureRoot = resource.objects.find((item) => item.technicalFixture);
const fixtureGraph = fixtureRoot ? core.graphSlice(resource, { ...analyst, currentObjectId: fixtureRoot.id }) : { nodes: [] };
if (fixtureRoot) assert.ok(fixtureGraph.nodes.some((node) => node.technicalFixture), "technical fixture graph is available only from a fixture root");

console.log(JSON.stringify({
  suite: "ofw.m07.research.v1.contracts",
  passed: true,
  analystLinks: analystLinks.length,
  restrictedLinks: restrictedLinks.length,
  analystNodes: analystGraph.nodes.length,
  restrictedNodes: restrictedGraph.nodes.length,
  capped: capped.truncated,
  fixtureNodes: fixtureGraph.nodes.length,
  rootId,
  resourceVersion: resource.resourceVersion || resource.schemaVersion,
}));
