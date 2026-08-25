import crypto from "node:crypto";
import { Readable } from "node:stream";
import { assertPrEnvironment } from "./quality-gate.mjs";

export const PROVIDER_SCHEMA_VERSION = "implementation-pr-environment-provider.v1";
export const CLEANUP_SCHEMA_VERSION = "implementation-pr-environment-cleanup.v1";
export const FINGERPRINT_SCHEMA_VERSION = "implementation-object-storage-fingerprint.v1";
export const LIVE_PROVISIONING_MODE = "live-provider";
export const DESCRIPTOR_PROVISIONING_MODE = "descriptor-only-provider-hook-required";
export const DEFAULT_LEASE_SECONDS = 60 * 60;
export const MAX_LEASE_SECONDS = 6 * 60 * 60;
export const MIN_LEASE_SECONDS = 15 * 60;

const RECEIPT_FIELDS = new Set([
  "schemaVersion", "receiptId", "receiptDigest", "status", "productionEvidence",
  "provisioningMode", "environmentId", "pullRequest", "implementationRoundId",
  "resources", "credentialLease", "health", "provisionedAt", "expiresAt", "cleanupPlan"
]);
const RESOURCE_FIELDS = new Set([
  "databaseSchema", "moduleSchemas", "postgresRole", "objectStorageBucket", "objectStoragePrefix",
  "markerObject", "queueNamespace", "jetStreamName", "subject", "runtimeCredentialRefs",
  "minioRuntimeScope", "natsRuntimeIdentity"
]);
const HEALTH_FIELDS = new Set(["postgres", "minio", "nats"]);

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(message, details = []) {
  const error = new Error(message);
  error.name = "PrEnvironmentProviderError";
  error.details = details;
  throw error;
}

function strictFields(value, allowed, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${path} must be an object`);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`${path} contains unknown fields`, unknown.map((key) => ({ path: `${path}.${key}`, code: "UNKNOWN_FIELD" })));
}

function iso(value, field) {
  if (!nonEmpty(value) || Number.isNaN(Date.parse(value))) fail(`${field} must be an ISO date-time`);
  return new Date(value).toISOString();
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return crypto.createHash("sha256").update(Buffer.isBuffer(value) ? value : Buffer.from(String(value))).digest("hex");
}

export function digestReceipt(receipt) {
  const copy = JSON.parse(JSON.stringify(receipt));
  delete copy.receiptDigest;
  return sha256(stable(copy));
}

function quoteIdentifier(value) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) fail(`unsafe PostgreSQL identifier: ${value}`);
  return `"${value}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function errorText(error) {
  return String(error?.message || error || "unknown provider error").replace(/(?:password|secret|token)=?[^\s,;]*/gi, "[redacted]");
}

function streamName(environmentId) {
  return environmentId.replaceAll("-", "_").toUpperCase();
}

function bucketName(environmentId) {
  return `ofw-${environmentId}`;
}

function postgresRole(databaseSchema) {
  return `${databaseSchema}_app`;
}

function runtimeCredentialRefs(descriptor) {
  return Object.freeze({
    postgres: `${descriptor.credentialRef}/postgres-app`,
    minio: `${descriptor.credentialRef}/minio-sts`,
    nats: `${descriptor.credentialRef}/nats-app`
  });
}

function natsRuntimePrincipal(environmentId) {
  return `runtime_${environmentId.replaceAll("-", "_")}`;
}

function natsPermissions(queueNamespace, jetStreamName) {
  return Object.freeze({
    publish: Object.freeze([
      `${queueNamespace}.>`,
      `$JS.API.STREAM.INFO.${jetStreamName}`,
      `$JS.API.CONSUMER.CREATE.${jetStreamName}`,
      `$JS.API.CONSUMER.CREATE.${jetStreamName}.>`,
      `$JS.API.CONSUMER.DURABLE.CREATE.${jetStreamName}.>`,
      `$JS.API.CONSUMER.INFO.${jetStreamName}.>`,
      `$JS.API.CONSUMER.MSG.NEXT.${jetStreamName}.>`,
      `$JS.API.CONSUMER.DELETE.${jetStreamName}.>`,
      `$JS.ACK.${jetStreamName}.>`
    ]),
    subscribe: Object.freeze(["_INBOX.>"])
  });
}

export function minioRuntimePolicy(resources) {
  return Object.freeze({
    Version: "2012-10-17",
    Statement: Object.freeze([
      Object.freeze({
        Effect: "Allow",
        Action: Object.freeze(["s3:GetBucketLocation"]),
        Resource: `arn:aws:s3:::${resources.objectStorageBucket}`
      }),
      Object.freeze({
        Effect: "Allow",
        Action: Object.freeze(["s3:ListBucket"]),
        Resource: `arn:aws:s3:::${resources.objectStorageBucket}`,
        Condition: Object.freeze({ StringLike: Object.freeze({ "s3:prefix": Object.freeze([`${resources.objectStoragePrefix}*`]) }) })
      }),
      Object.freeze({
        Effect: "Allow",
        Action: Object.freeze(["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]),
        Resource: `arn:aws:s3:::${resources.objectStorageBucket}/${resources.objectStoragePrefix}*`
      })
    ])
  });
}

export function deriveLiveResources(descriptor) {
  assertPrEnvironment(descriptor);
  const markerObject = `${descriptor.objectStoragePrefix}.environment.json`;
  const jetStreamName = streamName(descriptor.id);
  const resources = {
    databaseSchema: descriptor.databaseSchema,
    moduleSchemas: ["m01", "m02", "m03", "m04", "m05", "m06"].map((moduleId) => `${descriptor.databaseSchema}_${moduleId}`),
    postgresRole: postgresRole(descriptor.databaseSchema),
    objectStorageBucket: bucketName(descriptor.id),
    objectStoragePrefix: descriptor.objectStoragePrefix,
    markerObject,
    queueNamespace: descriptor.queueNamespace,
    jetStreamName,
    subject: `${descriptor.queueNamespace}.>`,
    runtimeCredentialRefs: runtimeCredentialRefs(descriptor),
    minioRuntimeScope: Object.freeze({
      bucket: bucketName(descriptor.id),
      prefix: descriptor.objectStoragePrefix,
      credentialMode: "sts-inline-session-policy",
      revocationMode: "sts-expiry-and-resource-cleanup"
    }),
    natsRuntimeIdentity: Object.freeze({
      principal: natsRuntimePrincipal(descriptor.id),
      credentialMode: "server-startup-config",
      revocationMode: "job-container-stop",
      permissions: natsPermissions(descriptor.queueNamespace, jetStreamName)
    })
  };
  return Object.freeze(resources);
}

export function assertRuntimeObjectScope(resources, bucket, objectName) {
  if (bucket !== resources.objectStorageBucket || !nonEmpty(objectName) || !objectName.startsWith(resources.objectStoragePrefix)) {
    fail("runtime MinIO access is outside the exact PR prefix", [{ code: "MINIO_RUNTIME_SCOPE_DENIED", path: `${bucket}/${objectName}` }]);
  }
  return true;
}

function natsSubjectMatches(pattern, subject) {
  if (pattern === subject) return true;
  return pattern.endsWith(">") && subject.startsWith(pattern.slice(0, -1));
}

export function assertRuntimeNatsScope(resources, operation, subject) {
  if (!new Set(["publish", "subscribe"]).has(operation) || !nonEmpty(subject)) fail("runtime NATS scope check requires publish/subscribe and a subject");
  const allowed = resources.natsRuntimeIdentity?.permissions?.[operation] || [];
  if (!allowed.some((pattern) => natsSubjectMatches(pattern, subject))) {
    fail("runtime NATS access is outside the exact PR subject scope", [{ code: "NATS_RUNTIME_SCOPE_DENIED", path: subject }]);
  }
  return true;
}

export function createRuntimeScopeGuard(resources) {
  validateRuntimeResources(resources);
  return Object.freeze({
    objectStorage: Object.freeze({
      assertAccess(bucket, objectName) { return assertRuntimeObjectScope(resources, bucket, objectName); }
    }),
    queue: Object.freeze({
      assertPublish(subject) { return assertRuntimeNatsScope(resources, "publish", subject); },
      assertSubscribe(subject) { return assertRuntimeNatsScope(resources, "subscribe", subject); }
    })
  });
}

export function prepareRuntimeCredentials(descriptor, options = {}) {
  const resources = deriveLiveResources(descriptor);
  return Object.freeze({
    postgresPassword: options.postgresPassword || crypto.randomBytes(32).toString("base64url"),
    natsUser: options.natsUser || resources.natsRuntimeIdentity.principal,
    natsPassword: options.natsPassword || crypto.randomBytes(32).toString("base64url")
  });
}

export function renderNatsServerConfig(descriptor, credentials, providerCredentials, options = {}) {
  const resources = deriveLiveResources(descriptor);
  const providerUser = providerCredentials?.user;
  const providerPassword = providerCredentials?.password;
  if (!nonEmpty(providerUser) || !nonEmpty(providerPassword) || !nonEmpty(credentials?.natsUser) || !nonEmpty(credentials?.natsPassword)) fail("NATS dual-user config requires provider and runtime credentials");
  if (credentials.natsUser !== resources.natsRuntimeIdentity.principal) fail("NATS runtime principal does not match the derived PR identity");
  const permissions = resources.natsRuntimeIdentity.permissions;
  const quotedList = (items) => `[${items.map((value) => JSON.stringify(value)).join(", ")}]`;
  const storeDir = options.storeDir || "/data/jetstream";
  const monitorPort = Number(options.monitorPort || 8222);
  if (!Number.isInteger(monitorPort) || monitorPort < 1 || monitorPort > 65535) fail("NATS monitor port is invalid");
  return `jetstream { store_dir: ${JSON.stringify(storeDir)} }\nhttp: ${monitorPort}\nauthorization {\n  users = [\n    { user: ${JSON.stringify(providerUser)}, password: ${JSON.stringify(providerPassword)}, permissions: { publish: ">", subscribe: ">" } },\n    { user: ${JSON.stringify(credentials.natsUser)}, password: ${JSON.stringify(credentials.natsPassword)}, permissions: { publish: { allow: ${quotedList(permissions.publish)} }, subscribe: { allow: ${quotedList(permissions.subscribe)} } } }\n  ]\n}\n`;
}

function descriptorPullRequest(descriptor) {
  const match = /^pr-([1-9][0-9]*)-([a-f0-9]{12})$/.exec(String(descriptor.id || ""));
  if (!match) fail("descriptor id is not a PR environment identity");
  return {
    number: Number(descriptor.pullRequestNumber || match[1]),
    headSha: String(descriptor.headSha || match[2]).toLowerCase()
  };
}

function leaseWindow(nowValue, leaseSeconds) {
  const seconds = Number(leaseSeconds ?? DEFAULT_LEASE_SECONDS);
  if (!Number.isInteger(seconds) || seconds < MIN_LEASE_SECONDS || seconds > MAX_LEASE_SECONDS) {
    fail(`leaseSeconds must be an integer between ${MIN_LEASE_SECONDS} and ${MAX_LEASE_SECONDS}`);
  }
  const issuedAt = new Date(nowValue || Date.now());
  if (Number.isNaN(issuedAt.getTime())) fail("now must be a valid date-time");
  return {
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + seconds * 1000).toISOString()
  };
}

function health(status, checkedAt, details = {}) {
  return Object.freeze({ status, checkedAt, ...details });
}

function buildReceipt({ descriptor, resources, roundId, window, healthChecks }) {
  const pullRequest = descriptorPullRequest(descriptor);
  const base = {
    schemaVersion: PROVIDER_SCHEMA_VERSION,
    receiptId: "pending",
    status: "provisioned",
    productionEvidence: true,
    provisioningMode: LIVE_PROVISIONING_MODE,
    environmentId: descriptor.id,
    pullRequest,
    implementationRoundId: roundId,
    resources,
    credentialLease: {
      reference: descriptor.credentialRef,
      mode: "short-lived-least-privilege",
      issuedAt: window.issuedAt,
      expiresAt: window.expiresAt,
      scope: [resources.databaseSchema, resources.objectStoragePrefix, resources.queueNamespace],
      secretIncluded: false
    },
    health: healthChecks,
    provisionedAt: window.issuedAt,
    expiresAt: window.expiresAt,
    cleanupPlan: {
      command: "cleanup-pr-environment.mjs --live --execute --descriptor <descriptor> --receipt <receipt>",
      exactScopeOnly: true,
      postCleanupProbeRequired: true
    }
  };
  const identityDigest = sha256(stable(base));
  base.receiptId = `PRPROV-${identityDigest.slice(0, 24).toUpperCase()}`;
  base.receiptDigest = digestReceipt(base);
  return Object.freeze(base);
}

function checkHealthEntry(entry, path) {
  strictFields(entry, new Set(["status", "checkedAt", "server", "resource", "probeSequence", "runtimeScopeVerified", "crossScopeDenied"]), path);
  if (!new Set(["passed", "healthy", "ready"]).has(entry.status)) fail(`${path}.status is not healthy`);
  iso(entry.checkedAt, `${path}.checkedAt`);
  if (entry.runtimeScopeVerified !== true || entry.crossScopeDenied !== true) fail(`${path} must prove allowed runtime access and denied cross-scope access`);
}

function validateRuntimeResources(resources) {
  strictFields(resources.runtimeCredentialRefs, new Set(["postgres", "minio", "nats"]), "receipt.resources.runtimeCredentialRefs");
  for (const field of ["postgres", "minio", "nats"]) if (!nonEmpty(resources.runtimeCredentialRefs[field])) fail(`receipt.resources.runtimeCredentialRefs.${field} is required`);
  strictFields(resources.minioRuntimeScope, new Set(["bucket", "prefix", "credentialMode", "revocationMode"]), "receipt.resources.minioRuntimeScope");
  if (resources.minioRuntimeScope.bucket !== resources.objectStorageBucket || resources.minioRuntimeScope.prefix !== resources.objectStoragePrefix
      || resources.minioRuntimeScope.credentialMode !== "sts-inline-session-policy" || resources.minioRuntimeScope.revocationMode !== "sts-expiry-and-resource-cleanup") fail("MinIO runtime scope is not exact or short-lived");
  strictFields(resources.natsRuntimeIdentity, new Set(["principal", "credentialMode", "revocationMode", "permissions"]), "receipt.resources.natsRuntimeIdentity");
  if (!nonEmpty(resources.natsRuntimeIdentity.principal) || resources.natsRuntimeIdentity.credentialMode !== "server-startup-config" || resources.natsRuntimeIdentity.revocationMode !== "job-container-stop") fail("NATS runtime identity lifecycle is invalid");
  strictFields(resources.natsRuntimeIdentity.permissions, new Set(["publish", "subscribe"]), "receipt.resources.natsRuntimeIdentity.permissions");
  for (const operation of ["publish", "subscribe"]) {
    const values = resources.natsRuntimeIdentity.permissions[operation];
    if (!Array.isArray(values) || values.length === 0 || values.some((value) => !nonEmpty(value))) fail(`NATS ${operation} permissions are required`);
  }
  assertRuntimeObjectScope(resources, resources.objectStorageBucket, resources.markerObject);
  assertRuntimeNatsScope(resources, "publish", `${resources.queueNamespace}.permission-probe`);
  try { assertRuntimeObjectScope(resources, resources.objectStorageBucket, `outside/${resources.environmentId || "denied"}`); fail("MinIO cross-scope policy did not deny an outside key"); }
  catch (error) { if (!error.details?.some((item) => item.code === "MINIO_RUNTIME_SCOPE_DENIED")) throw error; }
  try { assertRuntimeNatsScope(resources, "publish", `outside.${resources.queueNamespace}.denied`); fail("NATS cross-scope policy did not deny an outside subject"); }
  catch (error) { if (!error.details?.some((item) => item.code === "NATS_RUNTIME_SCOPE_DENIED")) throw error; }
}

export function assertProviderReceipt(receipt, options = {}) {
  strictFields(receipt, RECEIPT_FIELDS, "receipt");
  if (receipt.schemaVersion !== PROVIDER_SCHEMA_VERSION) fail("unsupported provider receipt schemaVersion");
  if (!new Set(["provisioned", "verified"]).has(receipt.status)) fail("provider receipt status must be provisioned or verified");
  if (receipt.productionEvidence !== true || receipt.provisioningMode !== LIVE_PROVISIONING_MODE) fail("descriptor-only receipt cannot be implementation evidence");
  if (!nonEmpty(receipt.receiptId) || !/^[a-f0-9]{64}$/i.test(String(receipt.receiptDigest || ""))) fail("provider receipt identity/digest is invalid");
  if (digestReceipt(receipt) !== receipt.receiptDigest) fail("provider receipt digest does not match its content");
  if (!nonEmpty(receipt.environmentId) || !nonEmpty(receipt.implementationRoundId)) fail("provider receipt environmentId and implementationRoundId are required");
  strictFields(receipt.resources, RESOURCE_FIELDS, "receipt.resources");
  for (const field of RESOURCE_FIELDS) {
    if (field === "moduleSchemas") {
      if (!Array.isArray(receipt.resources.moduleSchemas) || receipt.resources.moduleSchemas.length !== 6 || receipt.resources.moduleSchemas.some((value) => !nonEmpty(value))) fail("receipt.resources.moduleSchemas must contain six exact schemas");
    } else if (new Set(["runtimeCredentialRefs", "minioRuntimeScope", "natsRuntimeIdentity"]).has(field)) {
      if (!receipt.resources[field] || typeof receipt.resources[field] !== "object" || Array.isArray(receipt.resources[field])) fail(`receipt.resources.${field} is required`);
    } else if (!nonEmpty(receipt.resources[field])) fail(`receipt.resources.${field} is required`);
  }
  validateRuntimeResources(receipt.resources);
  strictFields(receipt.credentialLease, new Set(["reference", "mode", "issuedAt", "expiresAt", "scope", "secretIncluded"]), "receipt.credentialLease");
  if (!nonEmpty(receipt.credentialLease.reference) || receipt.credentialLease.mode !== "short-lived-least-privilege" || receipt.credentialLease.secretIncluded !== false) fail("credential lease is invalid or contains a secret");
  if (!Array.isArray(receipt.credentialLease.scope) || receipt.credentialLease.scope.length !== 3) fail("credential lease must declare three isolated scopes");
  const issuedAt = iso(receipt.credentialLease.issuedAt, "receipt.credentialLease.issuedAt");
  const leaseExpiresAt = iso(receipt.credentialLease.expiresAt, "receipt.credentialLease.expiresAt");
  const provisionedAt = iso(receipt.provisionedAt, "receipt.provisionedAt");
  const expiresAt = iso(receipt.expiresAt, "receipt.expiresAt");
  if (issuedAt !== provisionedAt || leaseExpiresAt !== expiresAt || Date.parse(expiresAt) <= Date.parse(provisionedAt)) fail("provider receipt lease window is inconsistent");
  if (options.now && Date.parse(expiresAt) <= Date.parse(options.now)) fail("provider receipt credential lease has expired");
  strictFields(receipt.health, HEALTH_FIELDS, "receipt.health");
  for (const field of HEALTH_FIELDS) checkHealthEntry(receipt.health[field], `receipt.health.${field}`);
  strictFields(receipt.pullRequest, new Set(["number", "headSha"]), "receipt.pullRequest");
  if (!Number.isInteger(receipt.pullRequest.number) || receipt.pullRequest.number <= 0 || !/^[a-f0-9]{7,64}$/i.test(String(receipt.pullRequest.headSha || ""))) fail("provider receipt pull request identity is invalid");
  strictFields(receipt.cleanupPlan, new Set(["command", "exactScopeOnly", "postCleanupProbeRequired"]), "receipt.cleanupPlan");
  if (!nonEmpty(receipt.cleanupPlan.command) || receipt.cleanupPlan.exactScopeOnly !== true || receipt.cleanupPlan.postCleanupProbeRequired !== true) fail("provider cleanup plan is not fail-closed");

  if (options.descriptor) {
    assertPrEnvironment(options.descriptor);
    const expected = deriveLiveResources(options.descriptor);
    if (receipt.environmentId !== options.descriptor.id || receipt.credentialLease.reference !== options.descriptor.credentialRef) fail("provider receipt does not match descriptor identity");
    for (const field of RESOURCE_FIELDS) if (stable(receipt.resources[field]) !== stable(expected[field])) fail(`provider receipt resource ${field} does not match descriptor`);
  }
  if (options.pullRequestNumber !== undefined && receipt.pullRequest.number !== Number(options.pullRequestNumber)) fail("provider receipt PR number mismatch");
  if (options.headSha !== undefined && receipt.pullRequest.headSha !== String(options.headSha).toLowerCase()) fail("provider receipt head SHA mismatch");
  if (options.roundId !== undefined && receipt.implementationRoundId !== options.roundId) fail("provider receipt implementation round mismatch");
  return receipt;
}

function parseMinioEndpoint(value) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.pathname !== "/") fail("MinIO endpoint must be an http(s) origin");
  return { endPoint: url.hostname, port: Number(url.port || (url.protocol === "https:" ? 443 : 80)), useSSL: url.protocol === "https:" };
}

async function listMinioObjects(client, bucket, prefix) {
  return await new Promise((resolve, reject) => {
    const records = [];
    const stream = client.listObjectsV2(bucket, prefix, true);
    stream.on("data", (item) => records.push(item));
    stream.on("error", reject);
    stream.on("end", () => resolve(records.sort((a, b) => String(a.name).localeCompare(String(b.name)))));
  });
}

async function readMinioObject(client, bucket, name) {
  const stream = await client.getObject(bucket, name);
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function isNatsNotFound(error) {
  return /stream not found|10059|404/i.test(errorText(error));
}

async function expectNatsPermissionDenied(connection, subject) {
  const iterator = connection.status()[Symbol.asyncIterator]();
  try {
    connection.publish(subject, Buffer.from("scope-denial-probe"));
    await connection.flush();
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      const remaining = Math.max(1, deadline - Date.now());
      const result = await Promise.race([
        iterator.next(),
        new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), remaining))
      ]);
      if (result?.timeout || result?.done) break;
      const error = result.value?.error;
      if (result.value?.type === "error" && (error?.name === "PermissionViolationError" || /permissions violation/i.test(String(error?.message || "")))) return true;
    }
  } catch (error) {
    if (error?.name === "PermissionViolationError" || /permissions violation/i.test(String(error?.message || ""))) return true;
    throw error;
  } finally {
    await iterator.return?.();
  }
  return false;
}

export async function createLiveAdapters(env = process.env) {
  const postgresUrl = env.PR_PROVIDER_POSTGRES_URL || env.DATABASE_URL;
  const minioEndpoint = env.PR_PROVIDER_MINIO_ENDPOINT || env.MINIO_ENDPOINT;
  const minioAccessKey = env.PR_PROVIDER_MINIO_ACCESS_KEY || env.MINIO_ROOT_USER || env.MINIO_ACCESS_KEY;
  const minioSecretKey = env.PR_PROVIDER_MINIO_SECRET_KEY || env.MINIO_ROOT_PASSWORD || env.MINIO_SECRET_KEY;
  const natsUrl = env.PR_PROVIDER_NATS_URL || env.NATS_URL;
  if (!postgresUrl) fail("PR_PROVIDER_POSTGRES_URL or DATABASE_URL is required for live mode");
  if (!minioEndpoint || !minioAccessKey || !minioSecretKey) fail("MinIO endpoint and credentials are required for live mode");
  if (!natsUrl) fail("PR_PROVIDER_NATS_URL or NATS_URL is required for live mode");

  const [{ Client: PgClient }, Minio, { AssumeRoleProvider }, transport, jetstreamModule] = await Promise.all([
    import("pg"), import("minio"), import("minio/dist/esm/AssumeRoleProvider.mjs"), import("@nats-io/transport-node"), import("@nats-io/jetstream")
  ]);
  const pg = new PgClient({ connectionString: postgresUrl, application_name: "ofw-pr-environment-provider" });
  await pg.connect();
  const minio = new Minio.Client({ ...parseMinioEndpoint(minioEndpoint), accessKey: minioAccessKey, secretKey: minioSecretKey });
  const natsOptions = { servers: natsUrl, name: "ofw-pr-environment-provider", maxReconnectAttempts: 2 };
  if (env.PR_PROVIDER_NATS_TOKEN || env.NATS_TOKEN) natsOptions.token = env.PR_PROVIDER_NATS_TOKEN || env.NATS_TOKEN;
  else {
    if (env.PR_PROVIDER_NATS_USER || env.NATS_USER) natsOptions.user = env.PR_PROVIDER_NATS_USER || env.NATS_USER;
    if (env.PR_PROVIDER_NATS_PASSWORD || env.NATS_PASSWORD) natsOptions.pass = env.PR_PROVIDER_NATS_PASSWORD || env.NATS_PASSWORD;
  }
  const nc = await transport.connect(natsOptions);
  const jsm = await jetstreamModule.jetstreamManager(nc);
  const js = jetstreamModule.jetstream(nc);
  const runtimeNatsUser = env.PR_RUNTIME_NATS_USER;
  const runtimeNatsPassword = env.PR_RUNTIME_NATS_PASSWORD;
  if (!runtimeNatsUser || !runtimeNatsPassword) fail("PR_RUNTIME_NATS_USER and PR_RUNTIME_NATS_PASSWORD from the dual-user startup config are required");
  const runtimeNc = await transport.connect({ servers: natsUrl, name: "ofw-pr-runtime-scope-probe", user: runtimeNatsUser, pass: runtimeNatsPassword, maxReconnectAttempts: 0 });
  const runtimeJs = jetstreamModule.jetstream(runtimeNc);
  const runtimeMinioAccessKey = env.PR_RUNTIME_MINIO_ACCESS_KEY;
  const runtimeMinioSecretKey = env.PR_RUNTIME_MINIO_SECRET_KEY;
  const runtimeMinioSessionToken = env.PR_RUNTIME_MINIO_SESSION_TOKEN;
  let runtimeMinio = runtimeMinioAccessKey && runtimeMinioSecretKey
    ? new Minio.Client({ ...parseMinioEndpoint(minioEndpoint), accessKey: runtimeMinioAccessKey, secretKey: runtimeMinioSecretKey, sessionToken: runtimeMinioSessionToken })
    : null;
  let minioScopeVerified = false;
  let natsScopeVerified = false;

  async function verifyMinioRuntimeScope(input) {
    if (!runtimeMinio) fail("MinIO runtime STS credentials are unavailable");
    await runtimeMinio.statObject(input.resources.objectStorageBucket, input.resources.markerObject);
    const outsideKey = `outside/${input.descriptor.id}/denied.json`;
    let denied = false;
    try {
      await runtimeMinio.putObject(input.resources.objectStorageBucket, outsideKey, Buffer.from("denied"), 6);
      await minio.removeObject(input.resources.objectStorageBucket, outsideKey).catch(() => {});
    } catch (scopeError) {
      denied = /access.?denied|not authorized|forbidden/i.test(`${scopeError?.code || ""} ${scopeError?.message || ""}`);
      if (!denied) throw scopeError;
    }
    if (!denied) fail("MinIO STS runtime credentials were able to write outside the exact PR prefix");
    minioScopeVerified = true;
  }

  async function verifyNatsRuntimeScope(input) {
    if (input.runtimeCredentials) {
      if (input.runtimeCredentials.natsUser !== input.resources.natsRuntimeIdentity.principal || input.runtimeCredentials.natsUser !== runtimeNatsUser || input.runtimeCredentials.natsPassword !== runtimeNatsPassword) fail("NATS runtime credentials do not match the startup identity descriptor");
    } else if (runtimeNatsUser !== input.resources.natsRuntimeIdentity.principal) fail("NATS runtime principal does not match the startup identity descriptor");
    const probeSubject = `${input.resources.queueNamespace}.runtime-permission-probe`;
    assertRuntimeNatsScope(input.resources, "publish", probeSubject);
    const runtimeAck = await runtimeJs.publish(probeSubject, Buffer.from(input.descriptor.id), { msgID: `${input.descriptor.id}-runtime-scope` });
    if (runtimeAck.stream !== input.resources.jetStreamName) fail("NATS runtime credential did not reach its exact PR stream");
    const outsideSubject = `outside.${input.resources.queueNamespace}.denied`;
    if (!(await expectNatsPermissionDenied(runtimeNc, outsideSubject))) fail("NATS runtime credential was not denied outside its exact PR subject scope");
    natsScopeVerified = true;
  }

  return {
    postgres: {
      async provision(input) {
        const schema = quoteIdentifier(input.resources.databaseSchema);
        const role = quoteIdentifier(input.resources.postgresRole);
        const password = input.secret;
        await pg.query("BEGIN");
        try {
          await pg.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.descriptor.id]);
          const roleExists = await pg.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [input.resources.postgresRole]);
          const schemaOwner = await pg.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = $1", [input.resources.databaseSchema]);
          const existingModules = await pg.query("SELECT nspname FROM pg_namespace WHERE nspname = ANY($1::text[])", [input.resources.moduleSchemas]);
          if (roleExists.rowCount > 0 || schemaOwner.rowCount > 0 || existingModules.rowCount > 0) fail("PostgreSQL PR resources already exist; use --probe or clean the prior receipt instead of reprovisioning");
          await pg.query(`CREATE ROLE ${role} LOGIN PASSWORD ${quoteLiteral(password)} VALID UNTIL ${quoteLiteral(input.expiresAt)}`);
          await pg.query(`REVOKE ALL ON SCHEMA public FROM ${role}`);
          await pg.query(`CREATE SCHEMA IF NOT EXISTS ${schema} AUTHORIZATION ${role}`);
          await pg.query(`ALTER SCHEMA ${schema} OWNER TO ${role}`);
          await pg.query(`GRANT USAGE, CREATE ON SCHEMA ${schema} TO ${role}`);
          for (const moduleSchemaName of input.resources.moduleSchemas) {
            const moduleSchema = quoteIdentifier(moduleSchemaName);
            const existingModule = await pg.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = $1", [moduleSchemaName]);
            if (existingModule.rowCount > 0 && existingModule.rows[0].owner !== input.resources.postgresRole) fail(`PostgreSQL module schema ${moduleSchemaName} has an unexpected owner`);
            await pg.query(`CREATE SCHEMA IF NOT EXISTS ${moduleSchema} AUTHORIZATION ${role}`);
            await pg.query(`ALTER SCHEMA ${moduleSchema} OWNER TO ${role}`);
            await pg.query(`GRANT USAGE, CREATE ON SCHEMA ${moduleSchema} TO ${role}`);
          }
          await pg.query(`CREATE TABLE IF NOT EXISTS ${schema}._pr_environment (environment_id text PRIMARY KEY, expires_at timestamptz NOT NULL)`);
          await pg.query(`INSERT INTO ${schema}._pr_environment(environment_id, expires_at) VALUES ($1, $2) ON CONFLICT (environment_id) DO UPDATE SET expires_at = EXCLUDED.expires_at`, [input.descriptor.id, input.expiresAt]);
          await pg.query("COMMIT");
        } catch (error) {
          await pg.query("ROLLBACK").catch(() => {});
          throw error;
        }
        const appUrl = new URL(postgresUrl);
        appUrl.username = input.resources.postgresRole;
        appUrl.password = password;
        return { databaseUrl: appUrl.toString(), runtimeScopeVerified: true, crossScopeDenied: true };
      },
      async probe(input) {
        const expectedSchemas = [input.resources.databaseSchema, ...input.resources.moduleSchemas];
        const result = await pg.query("SELECT (SELECT count(*)::int FROM information_schema.schemata WHERE schema_name = ANY($1::text[])) AS schema_count, EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$2) AS role_exists, has_schema_privilege($2, 'public', 'CREATE') AS public_create, has_database_privilege($2, current_database(), 'CREATE') AS database_create, version() AS server", [expectedSchemas, input.resources.postgresRole]);
        if (result.rows[0]?.schema_count !== expectedSchemas.length || !result.rows[0]?.role_exists) fail("PostgreSQL schema set or role probe failed");
        if (result.rows[0]?.public_create || result.rows[0]?.database_create) fail("PostgreSQL app role has CREATE outside its exact PR schemas");
        return { server: String(result.rows[0].server).split(" ").slice(0, 2).join(" "), resource: input.resources.databaseSchema, runtimeScopeVerified: true, crossScopeDenied: true };
      },
      async cleanup(input) {
        const role = quoteIdentifier(input.resources.postgresRole);
        for (const schemaName of [...input.resources.moduleSchemas].reverse()) await pg.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
        await pg.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(input.resources.databaseSchema)} CASCADE`);
        await pg.query(`DROP ROLE IF EXISTS ${role}`);
        const expectedSchemas = [input.resources.databaseSchema, ...input.resources.moduleSchemas];
        const result = await pg.query("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = ANY($1::text[])) AS schema_exists, EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$2) AS role_exists", [expectedSchemas, input.resources.postgresRole]);
        if (result.rows[0]?.schema_exists || result.rows[0]?.role_exists) fail("PostgreSQL cleanup post-probe failed");
        return { status: "absent", resource: input.resources.databaseSchema };
      }
    },
    objectStorage: {
      async provision(input) {
        await minio.listBuckets();
        if (await minio.bucketExists(input.resources.objectStorageBucket)) fail("MinIO PR bucket already exists; use --probe or clean the prior receipt instead of reprovisioning");
        await minio.makeBucket(input.resources.objectStorageBucket, "us-east-1");
        try {
          const body = Buffer.from(JSON.stringify({ environmentId: input.descriptor.id, expiresAt: input.expiresAt }));
          await minio.putObject(input.resources.objectStorageBucket, input.resources.markerObject, Readable.from(body), body.length, { "content-type": "application/json" });
          const sts = new AssumeRoleProvider({
            stsEndpoint: minioEndpoint,
            accessKey: minioAccessKey,
            secretKey: minioSecretKey,
            durationSeconds: input.leaseSeconds,
            policy: JSON.stringify(minioRuntimePolicy(input.resources)),
            roleSessionName: input.descriptor.id
          });
          const scoped = await sts.getCredentials();
          runtimeMinio = new Minio.Client({
            ...parseMinioEndpoint(minioEndpoint),
            accessKey: scoped.getAccessKey(),
            secretKey: scoped.getSecretKey(),
            sessionToken: scoped.getSessionToken()
          });
          await verifyMinioRuntimeScope(input);
          return {
            minioAccessKey: scoped.getAccessKey(),
            minioSecretKey: scoped.getSecretKey(),
            minioSessionToken: scoped.getSessionToken(),
            runtimeScopeVerified: true,
            crossScopeDenied: true
          };
        } catch (error) {
          const objects = await listMinioObjects(minio, input.resources.objectStorageBucket, "").catch(() => []);
          if (objects.length) await minio.removeObjects(input.resources.objectStorageBucket, objects.map((item) => item.name)).catch(() => {});
          await minio.removeBucket(input.resources.objectStorageBucket).catch(() => {});
          throw error;
        }
      },
      async probe(input) {
        if (!(await minio.bucketExists(input.resources.objectStorageBucket))) fail("MinIO bucket probe failed");
        await minio.statObject(input.resources.objectStorageBucket, input.resources.markerObject);
        const objects = await listMinioObjects(minio, input.resources.objectStorageBucket, input.resources.objectStoragePrefix);
        if (!objects.some((item) => item.name === input.resources.markerObject)) fail("MinIO prefix marker probe failed");
        if (!minioScopeVerified) await verifyMinioRuntimeScope(input);
        return { server: "minio-s3", resource: `${input.resources.objectStorageBucket}/${input.resources.objectStoragePrefix}`, runtimeScopeVerified: true, crossScopeDenied: true };
      },
      async fingerprint(input) {
        const objects = await listMinioObjects(minio, input.resources.objectStorageBucket, input.resources.objectStoragePrefix);
        const hash = crypto.createHash("sha256");
        for (const object of objects) {
          hash.update(object.name);
          hash.update("\0");
          hash.update(await readMinioObject(minio, input.resources.objectStorageBucket, object.name));
          hash.update("\0");
        }
        return { value: hash.digest("hex"), fileCount: objects.length, objects: objects.map((item) => item.name) };
      },
      async cleanup(input) {
        if (!(await minio.bucketExists(input.resources.objectStorageBucket))) return { status: "absent", resource: input.resources.objectStorageBucket };
        const all = await listMinioObjects(minio, input.resources.objectStorageBucket, "");
        const outside = all.filter((item) => !String(item.name).startsWith(input.resources.objectStoragePrefix));
        if (outside.length) fail("MinIO cleanup refused objects outside the exact PR prefix", outside.map((item) => ({ path: item.name, code: "OUTSIDE_SCOPE" })));
        if (all.length) await minio.removeObjects(input.resources.objectStorageBucket, all.map((item) => item.name));
        await minio.removeBucket(input.resources.objectStorageBucket);
        if (await minio.bucketExists(input.resources.objectStorageBucket)) fail("MinIO cleanup post-probe failed");
        return { status: "absent", resource: input.resources.objectStorageBucket };
      }
    },
    queue: {
      async provision(input) {
        await jsm.getAccountInfo();
        let info;
        try { info = await jsm.streams.info(input.resources.jetStreamName); }
        catch (error) { if (!isNatsNotFound(error)) throw error; }
        if (info) fail("JetStream PR stream already exists; use --probe or clean the prior receipt instead of reprovisioning");
        info = await jsm.streams.add({ name: input.resources.jetStreamName, subjects: [input.resources.subject], storage: jetstreamModule.StorageType.Memory, retention: jetstreamModule.RetentionPolicy.Limits, max_age: 6 * 60 * 60 * 1_000_000_000 });
        const subjects = [...(info.config?.subjects || [])].sort();
        if (subjects.length !== 1 || subjects[0] !== input.resources.subject) fail("JetStream subjects do not match the exact PR namespace");
        const probeSubject = `${input.resources.queueNamespace}.health`;
        let ack;
        try { ack = await js.publish(probeSubject, Buffer.from(input.descriptor.id)); }
        catch (error) {
          await jsm.streams.delete(input.resources.jetStreamName).catch(() => {});
          throw error;
        }
        if (ack.stream !== input.resources.jetStreamName) fail("JetStream probe was acknowledged by an unexpected stream");
        await verifyNatsRuntimeScope(input);
        return { probeSequence: ack.seq, runtimeScopeVerified: true, crossScopeDenied: true };
      },
      async probe(input) {
        await jsm.getAccountInfo();
        const info = await jsm.streams.info(input.resources.jetStreamName);
        if (!(info.config?.subjects || []).includes(input.resources.subject)) fail("JetStream stream probe failed");
        if (!natsScopeVerified) await verifyNatsRuntimeScope(input);
        return { server: "nats-jetstream", resource: input.resources.jetStreamName, probeSequence: info.state?.last_seq || 0, runtimeScopeVerified: true, crossScopeDenied: true };
      },
      async cleanup(input) {
        try { await jsm.streams.delete(input.resources.jetStreamName); }
        catch (error) { if (!isNatsNotFound(error)) throw error; }
        try {
          await jsm.streams.info(input.resources.jetStreamName);
          fail("JetStream cleanup post-probe failed");
        } catch (error) {
          if (!isNatsNotFound(error)) throw error;
        }
        return { status: "absent", resource: input.resources.jetStreamName };
      }
    },
    async close() {
      await Promise.allSettled([pg.end(), nc.drain(), runtimeNc.drain()]);
    }
  };
}

async function withAdapters(options, operation) {
  const adapters = options.adapters || await createLiveAdapters(options.env);
  try { return await operation(adapters); }
  finally { if (!options.adapters && typeof adapters.close === "function") await adapters.close(); }
}

export async function provisionLiveEnvironment(options) {
  const descriptor = options.descriptor;
  assertPrEnvironment(descriptor, { pullRequestNumber: descriptor.pullRequestNumber, headSha: descriptor.headSha });
  if (!nonEmpty(options.roundId)) fail("implementation round id is required for live provisioning");
  const resources = deriveLiveResources(descriptor);
  const window = leaseWindow(options.now, options.leaseSeconds);
  const env = options.env || process.env;
  const runtimeCredentials = options.runtimeCredentials || prepareRuntimeCredentials(descriptor, {
    postgresPassword: env.PR_RUNTIME_POSTGRES_PASSWORD,
    natsUser: env.PR_RUNTIME_NATS_USER,
    natsPassword: env.PR_RUNTIME_NATS_PASSWORD
  });
  if (runtimeCredentials.natsUser !== resources.natsRuntimeIdentity.principal) fail("prepared NATS runtime principal does not match the PR resources");
  return await withAdapters(options, async (adapters) => {
    const input = { descriptor, resources, expiresAt: window.expiresAt, leaseSeconds: (Date.parse(window.expiresAt) - Date.parse(window.issuedAt)) / 1000, secret: runtimeCredentials.postgresPassword, runtimeCredentials };
    const completed = [];
    try {
      const postgresCredentials = await adapters.postgres.provision(input);
      completed.push(adapters.postgres);
      const objectStorageCredentials = await adapters.objectStorage.provision(input);
      completed.push(adapters.objectStorage);
      const queueProvision = await adapters.queue.provision(input);
      completed.push(adapters.queue);
      const checkedAt = new Date(options.now || Date.now()).toISOString();
      const [postgres, minio, nats] = await Promise.all([
        adapters.postgres.probe(input), adapters.objectStorage.probe(input), adapters.queue.probe(input)
      ]);
      const receipt = buildReceipt({
        descriptor, resources, roundId: options.roundId, window,
        healthChecks: {
          postgres: health("passed", checkedAt, postgres),
          minio: health("passed", checkedAt, minio),
          nats: health("passed", checkedAt, { ...nats, probeSequence: queueProvision?.probeSequence || nats.probeSequence })
        }
      });
      assertProviderReceipt(receipt, { descriptor, roundId: options.roundId });
      return Object.freeze({
        receipt,
        credentials: Object.freeze({
          databaseUrl: postgresCredentials?.databaseUrl,
          databasePassword: runtimeCredentials.postgresPassword,
          minioAccessKey: objectStorageCredentials?.minioAccessKey,
          minioSecretKey: objectStorageCredentials?.minioSecretKey,
          minioSessionToken: objectStorageCredentials?.minioSessionToken,
          natsUser: runtimeCredentials.natsUser,
          natsPassword: runtimeCredentials.natsPassword
        })
      });
    } catch (error) {
      const compensation = await Promise.allSettled(completed.reverse().map((adapter) => adapter.cleanup(input)));
      const failedCompensation = compensation.filter((result) => result.status === "rejected").length;
      const wrapped = new Error(`live provisioning failed; compensation failures=${failedCompensation}: ${errorText(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
  });
}

export async function probeLiveEnvironment(options) {
  const receipt = assertProviderReceipt(options.receipt, { descriptor: options.descriptor, roundId: options.roundId, now: options.now });
  return await withAdapters(options, async (adapters) => {
    const input = { descriptor: options.descriptor, resources: receipt.resources, expiresAt: receipt.expiresAt };
    const checkedAt = new Date(options.now || Date.now()).toISOString();
    const [postgres, minio, nats] = await Promise.all([
      adapters.postgres.probe(input), adapters.objectStorage.probe(input), adapters.queue.probe(input)
    ]);
    const verified = {
      ...receipt,
      status: "verified",
      health: {
        postgres: health("passed", checkedAt, postgres),
        minio: health("passed", checkedAt, minio),
        nats: health("passed", checkedAt, nats)
      }
    };
    verified.receiptDigest = digestReceipt(verified);
    return Object.freeze(verified);
  });
}

export async function fingerprintLiveObjectStorage(options) {
  const receipt = assertProviderReceipt(options.receipt, { descriptor: options.descriptor, roundId: options.roundId, now: options.now });
  return await withAdapters(options, async (adapters) => {
    const result = await adapters.objectStorage.fingerprint({ descriptor: options.descriptor, resources: receipt.resources, expiresAt: receipt.expiresAt });
    if (!Number.isInteger(result.fileCount) || result.fileCount < 1 || !/^[a-f0-9]{64}$/i.test(result.value)) fail("live object-storage fingerprint is empty or invalid");
    const fingerprint = {
      schemaVersion: FINGERPRINT_SCHEMA_VERSION,
      receiptId: "pending",
      status: "verified",
      sourceType: "minio-live",
      productionEvidence: true,
      algorithm: "sha256",
      value: result.value,
      prefix: receipt.resources.objectStoragePrefix,
      bucket: receipt.resources.objectStorageBucket,
      fileCount: result.fileCount,
      environmentId: receipt.environmentId,
      pullRequest: receipt.pullRequest,
      implementationRoundId: receipt.implementationRoundId,
      providerReceiptId: receipt.receiptId,
      providerReceiptDigest: receipt.receiptDigest,
      formedAt: new Date(options.now || Date.now()).toISOString(),
      evidence: "artifact://object-storage-fingerprint.json"
    };
    fingerprint.receiptId = `OBJFP-${sha256(stable(fingerprint)).slice(0, 24).toUpperCase()}`;
    fingerprint.receiptDigest = digestReceipt(fingerprint);
    return Object.freeze(fingerprint);
  });
}

export async function cleanupLiveEnvironment(options) {
  const receipt = assertProviderReceipt(options.receipt, { descriptor: options.descriptor, roundId: options.roundId });
  return await withAdapters(options, async (adapters) => {
    const input = { descriptor: options.descriptor, resources: receipt.resources, expiresAt: receipt.expiresAt };
    const outcomes = {};
    const errors = [];
    for (const [name, adapter] of [["nats", adapters.queue], ["minio", adapters.objectStorage], ["postgres", adapters.postgres]]) {
      try { outcomes[name] = await adapter.cleanup(input); }
      catch (error) {
        outcomes[name] = { status: "failed", resource: name, reason: errorText(error) };
        errors.push({ resource: name, message: errorText(error) });
      }
    }
    const formedAt = new Date(options.now || Date.now()).toISOString();
    const cleanup = {
      schemaVersion: CLEANUP_SCHEMA_VERSION,
      receiptId: "pending",
      environmentId: receipt.environmentId,
      pullRequest: receipt.pullRequest,
      implementationRoundId: receipt.implementationRoundId,
      productionEvidence: true,
      provisioningReceiptId: receipt.receiptId,
      provisioningReceiptDigest: receipt.receiptDigest,
      resources: receipt.resources,
      status: errors.length ? "failed" : "completed",
      scopedDeletionPerformed: true,
      outsideScopeTouched: false,
      credentialLease: {
        reference: receipt.credentialLease.reference,
        runtimeCredentialRefs: receipt.resources.runtimeCredentialRefs,
        status: errors.length ? "revocation-incomplete" : "resource-access-revoked-lease-expiry-pending",
        minioRevocationMode: receipt.resources.minioRuntimeScope.revocationMode,
        natsRevocationMode: receipt.resources.natsRuntimeIdentity.revocationMode,
        expiresAt: receipt.credentialLease.expiresAt
      },
      results: outcomes,
      postCleanupProbe: {
        status: errors.length ? "failed" : "passed",
        allResourcesAbsent: errors.length === 0,
        checkedAt: formedAt
      },
      formedAt,
      evidence: "artifact://pr-environment-cleanup.json"
    };
    cleanup.receiptId = `PRCLEAN-${sha256(stable(cleanup)).slice(0, 24).toUpperCase()}`;
    cleanup.receiptDigest = digestReceipt(cleanup);
    if (errors.length) {
      const error = new Error(`live cleanup failed for: ${errors.map((item) => item.resource).join(", ")}`);
      error.receipt = cleanup;
      throw error;
    }
    return Object.freeze(cleanup);
  });
}
