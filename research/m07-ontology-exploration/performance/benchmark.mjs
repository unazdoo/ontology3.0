#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import v8 from "node:v8";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const NAMESPACE = "ofw.m07.research.v1.performance";
const SEED = 0x7a17c9e3;
const OBJECT_COUNT = 1_000_000;
const OBJECT_ID_WIDTH = 6;
const OBJECT_TYPE_COUNT = 6;
const OBJECT_STATUS_COUNT = 4;
const DIRECTORY_BUCKET_COUNT = OBJECT_TYPE_COUNT * OBJECT_STATUS_COUNT;
const GRAPH_DEGREE = 12;
const GRAPH_ROOT_COUNT = 8;
const GRAPH_RESULT_CAP = 5_000;
const TIME_SERIES_POINT_COUNT = 1_000_000;
const TIME_SERIES_BUCKET_COUNT = 1_000;
const SPATIAL_POINT_COUNT = 500_000;
const SPATIAL_CELL_DEGREES = 1;
const SPATIAL_X_CELLS = 360;
const SPATIAL_Y_CELLS = 170;
const SPATIAL_RESULT_CAP = 2_000;

const GATES = Object.freeze({
  datasetBuildMs: 30_000,
  objectDirectoryP50Ms: 20,
  objectDirectoryP95Ms: 50,
  graphExpansionP50Ms: 20,
  graphExpansionP95Ms: 50,
  timeSeriesTransformP50Ms: 150,
  timeSeriesTransformP95Ms: 250,
  spatialRangeP50Ms: 20,
  spatialRangeP95Ms: 50,
  peakRssMiB: 768,
});

const DEFAULT_OUTPUT = fileURLToPath(new URL("./results.json", import.meta.url));

function parseArguments(argv) {
  const options = { output: DEFAULT_OUTPUT, write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error("--output requires a path");
      options.output = path.resolve(value);
      index += 1;
    } else if (argument === "--no-write") {
      options.write = false;
    } else if (argument === "--help" || argument === "-h") {
      console.log("Usage: node --expose-gc benchmark.mjs [--output PATH] [--no-write]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function mix32(input) {
  let value = input >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toMiB(bytes) {
  return round(bytes / 1024 / 1024);
}

function memorySnapshot() {
  const memory = process.memoryUsage();
  return {
    rssMiB: toMiB(memory.rss),
    heapUsedMiB: toMiB(memory.heapUsed),
    heapTotalMiB: toMiB(memory.heapTotal),
    externalMiB: toMiB(memory.external),
    arrayBuffersMiB: toMiB(memory.arrayBuffers),
  };
}

function maxRssMiB() {
  // Node normalizes process.resourceUsage().maxRSS to KiB on supported platforms.
  return round(process.resourceUsage().maxRSS / 1024);
}

function elapsedMs(operation) {
  const start = performance.now();
  const value = operation();
  return { value, durationMs: performance.now() - start };
}

function percentile(sortedSamples, percentileValue) {
  const index = Math.max(0, Math.ceil(percentileValue * sortedSamples.length) - 1);
  return sortedSamples[index];
}

function summarizeLatency(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const sum = samples.reduce((total, sample) => total + sample, 0);
  return {
    min: round(sorted[0]),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted.at(-1)),
    mean: round(sum / samples.length),
  };
}

function runSamples({ warmups, samples, operation }) {
  let aggregateChecksum = 0;
  for (let index = 0; index < warmups; index += 1) operation(index);

  const durations = [];
  let aggregateResultCount = 0;
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    const result = operation(index + warmups);
    durations.push(performance.now() - startedAt);
    aggregateResultCount += result.count;
    aggregateChecksum = mix32(aggregateChecksum ^ result.checksum ^ result.count);
  }

  return {
    warmups,
    samples,
    latencyMs: summarizeLatency(durations),
    aggregateResultCount,
    aggregateChecksum: `0x${aggregateChecksum.toString(16).padStart(8, "0")}`,
  };
}

function lowerBound(values, start, end, target) {
  let low = start;
  let high = end;
  while (low < high) {
    const middle = low + ((high - low) >>> 1);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function buildObjectDirectory() {
  const types = new Uint8Array(OBJECT_COUNT);
  const statuses = new Uint8Array(OBJECT_COUNT);
  const qualityScores = new Float32Array(OBJECT_COUNT);
  const bucketCounts = new Uint32Array(DIRECTORY_BUCKET_COUNT);

  for (let objectId = 0; objectId < OBJECT_COUNT; objectId += 1) {
    const hash = mix32(objectId ^ SEED);
    const type = hash % OBJECT_TYPE_COUNT;
    const status = (hash >>> 5) % OBJECT_STATUS_COUNT;
    types[objectId] = type;
    statuses[objectId] = status;
    qualityScores[objectId] = ((hash >>> 8) & 0xffff) / 0xffff;
    bucketCounts[type * OBJECT_STATUS_COUNT + status] += 1;
  }

  const bucketOffsets = new Uint32Array(DIRECTORY_BUCKET_COUNT + 1);
  for (let bucket = 0; bucket < DIRECTORY_BUCKET_COUNT; bucket += 1) {
    bucketOffsets[bucket + 1] = bucketOffsets[bucket] + bucketCounts[bucket];
  }

  const writeOffsets = bucketOffsets.slice(0, DIRECTORY_BUCKET_COUNT);
  const postings = new Uint32Array(OBJECT_COUNT);
  for (let objectId = 0; objectId < OBJECT_COUNT; objectId += 1) {
    const bucket = types[objectId] * OBJECT_STATUS_COUNT + statuses[objectId];
    postings[writeOffsets[bucket]] = objectId;
    writeOffsets[bucket] += 1;
  }

  return { types, statuses, qualityScores, bucketOffsets, postings };
}

function objectPrefixRange(prefix) {
  const match = /^OBJ-(\d{1,6})$/.exec(prefix);
  if (!match) throw new Error(`Invalid synthetic object prefix: ${prefix}`);
  const digits = match[1];
  const scale = 10 ** (OBJECT_ID_WIDTH - digits.length);
  const start = Number(digits) * scale;
  return {
    start,
    end: Math.min(OBJECT_COUNT - 1, start + scale - 1),
  };
}

function queryObjectDirectory(index, query) {
  const range = objectPrefixRange(query.searchPrefix);
  const bucket = query.type * OBJECT_STATUS_COUNT + query.status;
  const bucketStart = index.bucketOffsets[bucket];
  const bucketEnd = index.bucketOffsets[bucket + 1];
  const firstCandidate = Math.max(range.start, query.afterObjectId + 1);
  let cursor = lowerBound(index.postings, bucketStart, bucketEnd, firstCandidate);
  const ids = [];

  while (cursor < bucketEnd && ids.length < query.pageSize) {
    const objectId = index.postings[cursor];
    if (objectId > range.end) break;
    if (index.qualityScores[objectId] >= query.minimumQuality) ids.push(objectId);
    cursor += 1;
  }

  let checksum = 0;
  for (const objectId of ids) checksum = mix32(checksum ^ objectId);
  return { ids, count: ids.length, checksum };
}

function makeDirectoryQuery(sampleIndex) {
  const hash = mix32(sampleIndex ^ 0xa8f3146d);
  const prefixNumber = hash % 100;
  const prefix = prefixNumber.toString().padStart(2, "0");
  const rangeStart = prefixNumber * 10_000;
  return {
    searchPrefix: `OBJ-${prefix}`,
    type: (hash >>> 7) % OBJECT_TYPE_COUNT,
    status: (hash >>> 11) % OBJECT_STATUS_COUNT,
    minimumQuality: 0.2 + ((hash >>> 16) % 35) / 100,
    afterObjectId: rangeStart + ((hash >>> 21) % 4_000) - 1,
    pageSize: 50,
  };
}

function validateDirectoryResult(index) {
  const query = makeDirectoryQuery(31);
  const result = queryObjectDirectory(index, query);
  const range = objectPrefixRange(query.searchPrefix);
  let previous = query.afterObjectId;
  for (const objectId of result.ids) {
    if (objectId <= previous || objectId < range.start || objectId > range.end) {
      throw new Error("Object directory ordering or prefix filtering is invalid");
    }
    if (index.types[objectId] !== query.type || index.statuses[objectId] !== query.status) {
      throw new Error("Object directory facet filtering is invalid");
    }
    if (index.qualityScores[objectId] < query.minimumQuality) {
      throw new Error("Object directory quality filtering is invalid");
    }
    previous = objectId;
  }
  return { checkedRows: result.count, passed: true };
}

function buildGraph() {
  const adjacency = new Uint32Array(OBJECT_COUNT * GRAPH_DEGREE);
  for (let objectId = 0; objectId < OBJECT_COUNT; objectId += 1) {
    const offset = objectId * GRAPH_DEGREE;
    for (let edge = 0; edge < GRAPH_DEGREE; edge += 1) {
      let neighbor = mix32(objectId ^ Math.imul(edge + 1, 0x9e3779b1) ^ SEED) % OBJECT_COUNT;
      if (neighbor === objectId) neighbor = (neighbor + 1) % OBJECT_COUNT;
      adjacency[offset + edge] = neighbor;
    }
  }
  return adjacency;
}

function createGraphExpander(adjacency, objectTypes) {
  const visitMarks = new Uint32Array(OBJECT_COUNT);
  let visitToken = 0;

  return function expandGraph(query) {
    visitToken += 1;
    if (visitToken === 0xffffffff) {
      visitMarks.fill(0);
      visitToken = 1;
    }

    const nodes = [];
    let frontier = [];
    for (const root of query.roots) {
      if (visitMarks[root] === visitToken) continue;
      visitMarks[root] = visitToken;
      nodes.push(root);
      frontier.push(root);
    }

    let edgesVisited = 0;
    let truncated = false;
    for (let depth = 0; depth < query.hops && frontier.length > 0; depth += 1) {
      const nextFrontier = [];
      for (const objectId of frontier) {
        const offset = objectId * GRAPH_DEGREE;
        for (let edge = 0; edge < GRAPH_DEGREE; edge += 1) {
          const neighbor = adjacency[offset + edge];
          edgesVisited += 1;
          if ((query.typeMask & (1 << objectTypes[neighbor])) === 0) continue;
          if (visitMarks[neighbor] === visitToken) continue;
          if (nodes.length >= query.maxNodes) {
            truncated = true;
            continue;
          }
          visitMarks[neighbor] = visitToken;
          nodes.push(neighbor);
          nextFrontier.push(neighbor);
        }
      }
      frontier = nextFrontier;
    }

    let checksum = 0;
    for (const objectId of nodes) checksum = mix32(checksum ^ objectId);
    return { nodes, count: nodes.length, checksum, edgesVisited, truncated };
  };
}

function makeGraphQuery(sampleIndex) {
  const roots = [];
  for (let rootIndex = 0; rootIndex < GRAPH_ROOT_COUNT; rootIndex += 1) {
    roots.push(mix32(sampleIndex ^ Math.imul(rootIndex + 1, 0x85ebca6b)) % OBJECT_COUNT);
  }
  const hash = mix32(sampleIndex ^ 0x4fc53a91);
  const excludedType = hash % OBJECT_TYPE_COUNT;
  return {
    roots,
    hops: sampleIndex % 3 === 0 ? 1 : 2,
    typeMask: ((1 << OBJECT_TYPE_COUNT) - 1) ^ (1 << excludedType),
    maxNodes: GRAPH_RESULT_CAP,
  };
}

function validateGraphResult(expandGraph) {
  const query = makeGraphQuery(42);
  query.hops = 2;
  const result = expandGraph(query);
  if (result.nodes.length > query.maxNodes) throw new Error("Graph result cap was exceeded");
  if (new Set(result.nodes).size !== result.nodes.length) throw new Error("Graph result contains duplicate nodes");
  for (const root of query.roots) {
    if (!result.nodes.includes(root)) throw new Error("Graph result omitted a root object");
  }
  return {
    roots: query.roots.length,
    hops: query.hops,
    returnedNodes: result.nodes.length,
    edgesVisited: result.edgesVisited,
    passed: true,
  };
}

function buildTimeSeries() {
  const values = new Float64Array(TIME_SERIES_POINT_COUNT);
  const quality = new Uint8Array(TIME_SERIES_POINT_COUNT);
  let randomState = SEED;
  for (let index = 0; index < TIME_SERIES_POINT_COUNT; index += 1) {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    randomState >>>= 0;
    const noise = (randomState / 0xffffffff - 0.5) * 0.7;
    values[index] = 100 + index * 0.000004 + Math.sin(index * 0.004) * 2.8 + noise;
    quality[index] = index % 9_973 === 0 ? 0 : 1;
  }
  return { values, quality };
}

function analyzeTimeSeries(series, query) {
  const bucketCount = query.bucketCount;
  const rawMin = new Float64Array(bucketCount);
  const rawMax = new Float64Array(bucketCount);
  const rollingMin = new Float64Array(bucketCount);
  const rollingMax = new Float64Array(bucketCount);
  const differenceMin = new Float64Array(bucketCount);
  const differenceMax = new Float64Array(bucketCount);
  rawMin.fill(Infinity);
  rawMax.fill(-Infinity);
  rollingMin.fill(Infinity);
  rollingMax.fill(-Infinity);
  differenceMin.fill(Infinity);
  differenceMax.fill(-Infinity);

  const pointsPerBucket = Math.ceil(series.values.length / bucketCount);
  let rollingSum = 0;
  let rollingCount = 0;
  let missingCount = 0;
  let thresholdEventCount = 0;

  for (let index = 0; index < series.values.length; index += 1) {
    const isValid = series.quality[index] === 1;
    if (isValid) {
      rollingSum += series.values[index];
      rollingCount += 1;
    } else {
      missingCount += 1;
    }

    const expiredIndex = index - query.rollingWindow;
    if (expiredIndex >= 0 && series.quality[expiredIndex] === 1) {
      rollingSum -= series.values[expiredIndex];
      rollingCount -= 1;
    }

    const bucket = Math.min(bucketCount - 1, Math.floor(index / pointsPerBucket));
    if (isValid) {
      const rawValue = series.values[index];
      if (rawValue < rawMin[bucket]) rawMin[bucket] = rawValue;
      if (rawValue > rawMax[bucket]) rawMax[bucket] = rawValue;

      if (rollingCount > 0) {
        const rollingValue = rollingSum / rollingCount;
        if (rollingValue < rollingMin[bucket]) rollingMin[bucket] = rollingValue;
        if (rollingValue > rollingMax[bucket]) rollingMax[bucket] = rollingValue;
        if (rollingValue >= query.threshold) thresholdEventCount += 1;
      }

      if (index > 0 && series.quality[index - 1] === 1) {
        const difference = rawValue - series.values[index - 1];
        if (difference < differenceMin[bucket]) differenceMin[bucket] = difference;
        if (difference > differenceMax[bucket]) differenceMax[bucket] = difference;
      }
    }
  }

  let checksum = mix32(missingCount ^ thresholdEventCount);
  for (let bucket = 0; bucket < bucketCount; bucket += 97) {
    const value = Number.isFinite(rollingMax[bucket]) ? Math.round(rollingMax[bucket] * 1_000) : 0;
    checksum = mix32(checksum ^ value ^ bucket);
  }

  return {
    count: bucketCount,
    checksum,
    missingCount,
    thresholdEventCount,
    output: { rawMin, rawMax, rollingMin, rollingMax, differenceMin, differenceMax },
  };
}

function makeTimeSeriesQuery(sampleIndex) {
  const rollingWindows = [24, 168, 720, 1_440];
  return {
    bucketCount: TIME_SERIES_BUCKET_COUNT,
    rollingWindow: rollingWindows[sampleIndex % rollingWindows.length],
    threshold: 102.5 + (sampleIndex % 4) * 0.5,
  };
}

function validateTimeSeriesResult(series) {
  const result = analyzeTimeSeries(series, makeTimeSeriesQuery(3));
  const expectedMissing = Math.floor((TIME_SERIES_POINT_COUNT - 1) / 9_973) + 1;
  if (result.missingCount !== expectedMissing) throw new Error("Time-series missing-value propagation is invalid");
  for (const values of Object.values(result.output)) {
    if (values.length !== TIME_SERIES_BUCKET_COUNT) throw new Error("Time-series downsample size is invalid");
  }
  return {
    inputPoints: TIME_SERIES_POINT_COUNT,
    outputBuckets: TIME_SERIES_BUCKET_COUNT,
    missingPoints: result.missingCount,
    rollingWindow: makeTimeSeriesQuery(3).rollingWindow,
    passed: true,
  };
}

function longitudeCell(longitude) {
  return Math.max(0, Math.min(SPATIAL_X_CELLS - 1, Math.floor((longitude + 180) / SPATIAL_CELL_DEGREES)));
}

function latitudeCell(latitude) {
  return Math.max(0, Math.min(SPATIAL_Y_CELLS - 1, Math.floor((latitude + 85) / SPATIAL_CELL_DEGREES)));
}

function buildSpatialIndex() {
  const longitudes = new Float32Array(SPATIAL_POINT_COUNT);
  const latitudes = new Float32Array(SPATIAL_POINT_COUNT);
  const cellCounts = new Uint32Array(SPATIAL_X_CELLS * SPATIAL_Y_CELLS);

  for (let pointId = 0; pointId < SPATIAL_POINT_COUNT; pointId += 1) {
    const longitudeHash = mix32(pointId ^ SEED ^ 0x6a09e667);
    const latitudeHash = mix32(pointId ^ SEED ^ 0xbb67ae85);
    const longitude = longitudeHash / 0x1_0000_0000 * 360 - 180;
    const latitude = latitudeHash / 0x1_0000_0000 * 170 - 85;
    longitudes[pointId] = longitude;
    latitudes[pointId] = latitude;
    const cell = latitudeCell(latitude) * SPATIAL_X_CELLS + longitudeCell(longitude);
    cellCounts[cell] += 1;
  }

  const cellOffsets = new Uint32Array(cellCounts.length + 1);
  for (let cell = 0; cell < cellCounts.length; cell += 1) {
    cellOffsets[cell + 1] = cellOffsets[cell] + cellCounts[cell];
  }
  const writeOffsets = cellOffsets.slice(0, cellCounts.length);
  const pointIds = new Uint32Array(SPATIAL_POINT_COUNT);
  for (let pointId = 0; pointId < SPATIAL_POINT_COUNT; pointId += 1) {
    const cell = latitudeCell(latitudes[pointId]) * SPATIAL_X_CELLS + longitudeCell(longitudes[pointId]);
    pointIds[writeOffsets[cell]] = pointId;
    writeOffsets[cell] += 1;
  }

  return { longitudes, latitudes, cellOffsets, pointIds };
}

function querySpatialRange(index, query) {
  const minimumLatitude = Math.max(-85, query.minimumLatitude);
  const maximumLatitude = Math.min(85, query.maximumLatitude);
  if (minimumLatitude > maximumLatitude) return { ids: [], count: 0, checksum: 0 };

  const longitudeRanges = query.minimumLongitude <= query.maximumLongitude
    ? [[query.minimumLongitude, query.maximumLongitude]]
    : [[query.minimumLongitude, 180], [-180, query.maximumLongitude]];
  const minimumY = latitudeCell(minimumLatitude);
  const maximumY = latitudeCell(maximumLatitude);
  const ids = [];
  let count = 0;
  let checksum = 0;

  for (const [minimumLongitude, maximumLongitude] of longitudeRanges) {
    const minimumX = longitudeCell(minimumLongitude);
    const maximumX = longitudeCell(maximumLongitude);
    for (let y = minimumY; y <= maximumY; y += 1) {
      for (let x = minimumX; x <= maximumX; x += 1) {
        const cell = y * SPATIAL_X_CELLS + x;
        for (let cursor = index.cellOffsets[cell]; cursor < index.cellOffsets[cell + 1]; cursor += 1) {
          const pointId = index.pointIds[cursor];
          const longitude = index.longitudes[pointId];
          const latitude = index.latitudes[pointId];
          if (longitude < minimumLongitude || longitude > maximumLongitude) continue;
          if (latitude < minimumLatitude || latitude > maximumLatitude) continue;
          count += 1;
          checksum = mix32(checksum ^ pointId);
          if (ids.length < query.resultCap) ids.push(pointId);
        }
      }
    }
  }

  return { ids, count, checksum, truncated: count > ids.length };
}

function normalizeLongitude(longitude) {
  let normalized = longitude;
  while (normalized < -180) normalized += 360;
  while (normalized > 180) normalized -= 360;
  return normalized;
}

function makeSpatialQuery(sampleIndex) {
  const hash = mix32(sampleIndex ^ 0x3c6ef372);
  const centerLongitude = (hash % 360_000) / 1_000 - 180;
  const centerLatitude = ((hash >>> 8) % 150_000) / 1_000 - 75;
  const width = 0.5 + ((hash >>> 16) % 9_500) / 1_000;
  const height = 0.5 + ((hash >>> 21) % 11_500) / 1_000;
  return {
    minimumLongitude: normalizeLongitude(centerLongitude - width / 2),
    maximumLongitude: normalizeLongitude(centerLongitude + width / 2),
    minimumLatitude: Math.max(-85, centerLatitude - height / 2),
    maximumLatitude: Math.min(85, centerLatitude + height / 2),
    resultCap: SPATIAL_RESULT_CAP,
  };
}

function validateSpatialResult(index) {
  const world = querySpatialRange(index, {
    minimumLongitude: -180,
    maximumLongitude: 180,
    minimumLatitude: -85,
    maximumLatitude: 85,
    resultCap: 10,
  });
  if (world.count !== SPATIAL_POINT_COUNT) throw new Error("World spatial query did not cover every point");

  const wrappedQuery = {
    minimumLongitude: 177,
    maximumLongitude: -177,
    minimumLatitude: -10,
    maximumLatitude: 10,
    resultCap: SPATIAL_RESULT_CAP,
  };
  const wrapped = querySpatialRange(index, wrappedQuery);
  for (const pointId of wrapped.ids) {
    const longitude = index.longitudes[pointId];
    const latitude = index.latitudes[pointId];
    if (!(longitude >= 177 || longitude <= -177) || latitude < -10 || latitude > 10) {
      throw new Error("Antimeridian spatial filtering is invalid");
    }
  }
  return {
    worldPointCount: world.count,
    antimeridianResultCount: wrapped.count,
    passed: true,
  };
}

function gate(name, actual, limit, unit) {
  return { name, actual: round(actual), operator: "<=", limit, unit, passed: actual <= limit };
}

function environmentInfo() {
  const cpus = os.cpus();
  const heap = v8.getHeapStatistics();
  return {
    capturedAt: new Date().toISOString(),
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    release: os.release(),
    architecture: process.arch,
    cpuModel: cpus[0]?.model ?? "unknown",
    logicalCpuCount: cpus.length,
    totalSystemMemoryMiB: toMiB(os.totalmem()),
    v8HeapLimitMiB: toMiB(heap.heap_size_limit),
    garbageCollectorExposed: typeof global.gc === "function",
  };
}

function collectGateResults(buildMs, phases, peakRss) {
  return [
    gate("dataset build", buildMs, GATES.datasetBuildMs, "ms"),
    gate("object directory p50", phases.objectDirectoryQuery.latencyMs.p50, GATES.objectDirectoryP50Ms, "ms"),
    gate("object directory p95", phases.objectDirectoryQuery.latencyMs.p95, GATES.objectDirectoryP95Ms, "ms"),
    gate("graph expansion p50", phases.graphExpansion.latencyMs.p50, GATES.graphExpansionP50Ms, "ms"),
    gate("graph expansion p95", phases.graphExpansion.latencyMs.p95, GATES.graphExpansionP95Ms, "ms"),
    gate("time-series transform p50", phases.timeSeriesTransform.latencyMs.p50, GATES.timeSeriesTransformP50Ms, "ms"),
    gate("time-series transform p95", phases.timeSeriesTransform.latencyMs.p95, GATES.timeSeriesTransformP95Ms, "ms"),
    gate("spatial range p50", phases.spatialRangeQuery.latencyMs.p50, GATES.spatialRangeP50Ms, "ms"),
    gate("spatial range p95", phases.spatialRangeQuery.latencyMs.p95, GATES.spatialRangeP95Ms, "ms"),
    gate("peak RSS", peakRss, GATES.peakRssMiB, "MiB"),
  ];
}

function printSummary(results, outputPath) {
  console.log(`\n${NAMESPACE}`);
  console.log(`overall: ${results.summary.passed ? "PASS" : "FAIL"}`);
  for (const result of results.gateResults) {
    console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.name}: ${result.actual} ${result.unit} <= ${result.limit} ${result.unit}`);
  }
  if (outputPath) console.log(`results: ${outputPath}`);
  console.log("scope: deterministic in-process technical validation; not production backend evidence");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (typeof global.gc !== "function") {
    console.warn("warning: run with --expose-gc for cleaner repeat measurements");
  }

  if (typeof global.gc === "function") global.gc();
  const memoryBeforeBuild = memorySnapshot();
  const buildStartedAt = performance.now();

  const directoryBuild = elapsedMs(buildObjectDirectory);
  const objectDirectory = directoryBuild.value;
  const graphBuild = elapsedMs(buildGraph);
  const graphAdjacency = graphBuild.value;
  const timeSeriesBuild = elapsedMs(buildTimeSeries);
  const timeSeries = timeSeriesBuild.value;
  const spatialBuild = elapsedMs(buildSpatialIndex);
  const spatialIndex = spatialBuild.value;
  const totalBuildMs = performance.now() - buildStartedAt;

  if (typeof global.gc === "function") global.gc();
  const memoryAfterBuild = memorySnapshot();
  const expandGraph = createGraphExpander(graphAdjacency, objectDirectory.types);

  const correctness = {
    objectDirectory: validateDirectoryResult(objectDirectory),
    graphExpansion: validateGraphResult(expandGraph),
    timeSeries: validateTimeSeriesResult(timeSeries),
    spatial: validateSpatialResult(spatialIndex),
  };

  const phases = {};
  phases.objectDirectoryQuery = runSamples({
    warmups: 100,
    samples: 600,
    operation: (sampleIndex) => queryObjectDirectory(objectDirectory, makeDirectoryQuery(sampleIndex)),
  });
  phases.objectDirectoryQuery.workload = {
    indexedObjects: OBJECT_COUNT,
    prefixFacetAndQualityFilter: true,
    cursorPagination: true,
    pageSize: 50,
  };

  phases.graphExpansion = runSamples({
    warmups: 50,
    samples: 300,
    operation: (sampleIndex) => expandGraph(makeGraphQuery(sampleIndex)),
  });
  phases.graphExpansion.workload = {
    graphNodes: OBJECT_COUNT,
    directedEdges: OBJECT_COUNT * GRAPH_DEGREE,
    degree: GRAPH_DEGREE,
    rootsPerQuery: GRAPH_ROOT_COUNT,
    hops: [1, 2],
    resultCap: GRAPH_RESULT_CAP,
    objectTypeFilter: true,
  };

  phases.timeSeriesTransform = runSamples({
    warmups: 3,
    samples: 20,
    operation: (sampleIndex) => analyzeTimeSeries(timeSeries, makeTimeSeriesQuery(sampleIndex)),
  });
  phases.timeSeriesTransform.workload = {
    inputPoints: TIME_SERIES_POINT_COUNT,
    outputBuckets: TIME_SERIES_BUCKET_COUNT,
    operations: ["min-max downsample", "quality-aware rolling mean", "first difference", "threshold event count"],
    missingValuePolicy: "quality=0 excluded from aggregates; adjacent difference unavailable",
  };

  phases.spatialRangeQuery = runSamples({
    warmups: 80,
    samples: 400,
    operation: (sampleIndex) => querySpatialRange(spatialIndex, makeSpatialQuery(sampleIndex)),
  });
  phases.spatialRangeQuery.workload = {
    indexedPoints: SPATIAL_POINT_COUNT,
    geometry: "WGS84 synthetic points",
    index: "1-degree uniform grid with exact point-in-bbox check",
    antimeridianAware: true,
    resultCap: SPATIAL_RESULT_CAP,
  };

  if (typeof global.gc === "function") global.gc();
  const memoryAfterBenchmark = memorySnapshot();
  const peakRss = maxRssMiB();
  const gateResults = collectGateResults(totalBuildMs, phases, peakRss);
  const passedGateCount = gateResults.filter((result) => result.passed).length;

  const results = {
    schemaVersion: 1,
    benchmark: NAMESPACE,
    evidenceClass: "isolated deterministic synthetic technical validation",
    disclaimer: "These results measure local in-process algorithms and data structures only. They do not establish production backend, network, concurrency, authorization, persistence, or service-SLO capability.",
    environment: environmentInfo(),
    deterministicInput: {
      seed: `0x${SEED.toString(16)}`,
      objectCount: OBJECT_COUNT,
      graphEdgeCount: OBJECT_COUNT * GRAPH_DEGREE,
      timeSeriesPointCount: TIME_SERIES_POINT_COUNT,
      spatialPointCount: SPATIAL_POINT_COUNT,
    },
    build: {
      totalMs: round(totalBuildMs),
      componentsMs: {
        objectDirectory: round(directoryBuild.durationMs),
        graphAdjacency: round(graphBuild.durationMs),
        timeSeries: round(timeSeriesBuild.durationMs),
        spatialIndex: round(spatialBuild.durationMs),
      },
    },
    correctness,
    phases,
    memory: {
      beforeBuild: memoryBeforeBuild,
      afterBuild: memoryAfterBuild,
      afterBenchmark: memoryAfterBenchmark,
      peakRssMiB: peakRss,
    },
    hardGateLimits: GATES,
    gateResults,
    summary: {
      passed: passedGateCount === gateResults.length,
      passedGateCount,
      totalGateCount: gateResults.length,
      productionClaim: false,
    },
  };

  if (options.write) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  }
  printSummary(results, options.write ? options.output : null);
  if (!results.summary.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
