import http from "node:http";
import { pathToFileURL } from "node:url";
import { DEFAULT_PORT, FORBIDDEN_CAPABILITIES, NAMESPACE } from "./constants.mjs";
import { ContractError } from "./errors.mjs";
import {
  buildDemo,
  decideReviewForScenario,
  requestReviewForScenario,
  runFixtureCase,
  validateBindingForScenario
} from "./demo.mjs";
import {
  findCompatibleObjectives,
  getObjective,
  listConsumers,
  listObjectives,
  projectObjectiveForConsumer,
  validateObjectiveBinding
} from "./objective-registry.mjs";

const MAX_BODY_BYTES = 64 * 1024;

function sourceContextForScenario({ scenarioId, scenarioVersion = null, scenarioRunId = null, formedAt = null, status = null }, sourceContext = null) {
  return {
    ...(sourceContext || {}),
    scenarioId,
    scenarioVersion,
    scenarioRunId,
    ...(formedAt ? { formedAt } : {}),
    ...(status ? { status } : {})
  };
}

function json(response, status, body) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "x-ofw-namespace": NAMESPACE
  });
  response.end(payload);
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw new ContractError("REQUEST_TOO_LARGE", "Request body exceeds 64 KiB.");
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new ContractError("INVALID_JSON", "Request body must be valid JSON.");
  }
}

function isForbiddenPath(pathname) {
  const normalized = pathname.toLowerCase();
  const routeTerms = [
    ...FORBIDDEN_CAPABILITIES,
    "action",
    "actions",
    "notifications",
    "approvals",
    "todos",
    "transactions",
    "webhooks",
    "schedules",
    "extended-functions"
  ];
  return routeTerms.some((term) => normalized.includes(term.toLowerCase()));
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    try {
      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type",
          "cache-control": "no-store"
        });
        response.end();
        return;
      }
      if (isForbiddenPath(url.pathname)) {
        json(response, 404, {
          namespace: NAMESPACE,
          code: "CAPABILITY_NOT_AVAILABLE",
          message: "The isolated simulation runtime exposes no side-effect capability."
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/health") {
        json(response, 200, {
          namespace: NAMESPACE,
          status: "ok",
          mode: "isolated-research-read-only",
          factWriteAllowed: false,
          publishedModelRegistrationAllowed: false,
          forbiddenCapabilities: FORBIDDEN_CAPABILITIES
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/objectives") {
        json(response, 200, {
          namespace: NAMESPACE,
          resourceKind: "ModelingObjectiveCatalog",
          objectives: listObjectives(),
          consumers: listConsumers().map(({ consumerId, moduleId, name, allowed }) => ({ consumerId, moduleId, name, allowed }))
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/objectives/compatible") {
        json(response, 200, {
          namespace: NAMESPACE,
          resourceKind: "CompatibleObjectiveSet",
          objectTypeRef: url.searchParams.get("objectTypeRef"),
          useKind: url.searchParams.get("useKind") || null,
          objectives: findCompatibleObjectives({
            objectTypeRef: url.searchParams.get("objectTypeRef"),
            useKind: url.searchParams.get("useKind") || null,
            scenarioId: url.searchParams.get("scenarioId") || null
          })
        });
        return;
      }
      const objectiveMatch = url.pathname.match(/^\/v1\/objectives\/([^/]+)$/);
      if (request.method === "GET" && objectiveMatch) {
        json(response, 200, getObjective(decodeURIComponent(objectiveMatch[1])));
        return;
      }
      const bindingMatch = url.pathname.match(/^\/v1\/objectives\/([^/]+)\/binding\/validate$/);
      if (request.method === "POST" && bindingMatch) {
        const body = await readJsonBody(request);
        json(response, 200, validateObjectiveBinding({
          objectiveId: decodeURIComponent(bindingMatch[1]),
          binding: body.binding || null
        }));
        return;
      }
      const consumerMatch = url.pathname.match(/^\/v1\/objectives\/([^/]+)\/consumer-projection$/);
      if (request.method === "GET" && consumerMatch) {
        json(response, 200, projectObjectiveForConsumer({
          objectiveId: decodeURIComponent(consumerMatch[1]),
          consumerId: url.searchParams.get("consumerId")
        }));
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/demo") {
        const scenarioId = url.searchParams.get("scenarioId") || "S005";
        json(response, 200, await buildDemo({
          scenarioId,
          sourceContext: sourceContextForScenario({
            scenarioId,
            scenarioVersion: url.searchParams.get("scenarioVersion") || null,
            scenarioRunId: url.searchParams.get("scenarioRunId") || null,
            formedAt: url.searchParams.get("formedAt") || null,
            status: url.searchParams.get("status") || null
          }, {
            dataVersionId: url.searchParams.get("dataVersionId") || null,
            ontologyVersionId: url.searchParams.get("ontologyVersionId") || null,
            semanticVersionId: url.searchParams.get("semanticVersionId") || null,
            bindingId: url.searchParams.get("bindingId") || null,
            projectionDigest: url.searchParams.get("projectionDigest") || null
          })
        }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/simulations/run") {
        const body = await readJsonBody(request);
        if (typeof body.caseId !== "string") {
          throw new ContractError(
            "CASE_ID_REQUIRED",
            "A fixture simulation caseId is required."
          );
        }
        const runNonce = typeof body.runNonce === "string" && body.runNonce.length > 0
          ? body.runNonce
          : `M08RUN-${Date.now().toString(36).toUpperCase()}`;
        const scenarioId = body.scenarioId || "S005";
        json(response, 200, await runFixtureCase(body.caseId, {
          scenarioId,
          runNonce,
          sourceContext: sourceContextForScenario({
            scenarioId,
            scenarioVersion: body.scenarioVersion || null,
            scenarioRunId: body.scenarioRunId || null,
            formedAt: body.formedAt || null,
            status: body.status || null
          }, {
            dataVersionId: body.dataVersionId || null,
            ontologyVersionId: body.ontologyVersionId || null,
            semanticVersionId: body.semanticVersionId || null,
            bindingId: body.bindingId || null,
            projectionDigest: body.projectionDigest || null,
            sourceKind: body.sourceKind || null,
            objectiveId: body.objectiveId || null,
            objectiveRevisionId: body.objectiveRevisionId || null,
            bindingRevisionId: body.bindingRevisionId || null,
            releaseId: body.releaseId || null,
            modelVersionId: body.modelVersionId || null,
            objectRef: body.objectRef || null,
            focusBaselineMemberRef: body.focusBaselineMemberRef || null,
            seriesRef: body.seriesRef || null,
            lensRef: body.lensRef || null,
            timeRange: body.timeRange || null,
            observation: body.observation || null
          })
        }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/reviews/request") {
        const body = await readJsonBody(request);
        const scenarioId = body.scenarioId || "S005";
        json(response, 200, await requestReviewForScenario({
          scenarioId,
          candidateId: body.candidateId,
          sourceContext: sourceContextForScenario({ scenarioId, scenarioVersion: body.scenarioVersion || null, scenarioRunId: body.scenarioRunId || null }, body.sourceContext)
        }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/reviews/decide") {
        const body = await readJsonBody(request);
        const scenarioId = body.scenarioId || "S005";
        json(response, 200, await decideReviewForScenario({
          scenarioId,
          candidateId: body.candidateId,
          reviewerId: body.reviewerId,
          rationale: body.rationale,
          decision: body.decision || "APPROVED",
          sourceContext: sourceContextForScenario({ scenarioId, scenarioVersion: body.scenarioVersion || null, scenarioRunId: body.scenarioRunId || null }, body.sourceContext)
        }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/bindings/validate") {
        const body = await readJsonBody(request);
        const scenarioId = body.scenarioId || "S005";
        json(response, 200, await validateBindingForScenario({
          scenarioId,
          candidateId: body.candidateId,
          reviewerId: body.reviewerId,
          rationale: body.rationale,
          sourceContext: sourceContextForScenario({ scenarioId, scenarioVersion: body.scenarioVersion || null, scenarioRunId: body.scenarioRunId || null }, body.sourceContext)
        }));
        return;
      }
      json(response, 404, {
        namespace: NAMESPACE,
        code: "NOT_FOUND",
        message: "Route not found."
      });
    } catch (error) {
      const status = error instanceof ContractError ? 422 : 500;
      json(response, status, {
        namespace: NAMESPACE,
        code: error.code || "INTERNAL_ERROR",
        message: error.message,
        details: error.details || {}
      });
    }
  });
}

export async function listen({ port = DEFAULT_PORT, host = "127.0.0.1" } = {}) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.M08_PORT || DEFAULT_PORT);
  const server = await listen({ port });
  const address = server.address();
  process.stdout.write(
    `M08 isolated research service listening on http://127.0.0.1:${address.port}\n`
  );
}
