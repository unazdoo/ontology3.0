import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
const fc = (features) => ({ type: "FeatureCollection", features });
const point = (coordinates, properties) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties,
});
const enterpriseLabel = (entity) => `${entity.name}（${entity.city}）`;
export function createMap({
  container,
  data,
  camera,
  onSelect,
  onCamera,
  onBoxSelect,
  onError,
}) {
  let ready = false,
    desired = null,
    activePopup = null,
    choosing = false,
    selectionEpoch = 0,
    suppressClickUntil = 0,
    boxStart = null,
    rectangle = null;
  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        oceanSurface: {
          type: "geojson",
          data: fc(
            [-180, -90, 0, 90].map((lon) => ({
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [lon, -85.051129],
                    [lon + 90, -85.051129],
                    [lon + 90, 85.051129],
                    [lon, 85.051129],
                    [lon, -85.051129],
                  ],
                ],
              },
            })),
          ),
        },
        world: { type: "geojson", data: "/data/world.geojson" },
        provinces: { type: "geojson", data: "/data/china-provinces.geojson" },
      },
      layers: [
        {
          id: "ocean",
          type: "background",
          paint: { "background-color": "#f0f4f5" },
        },
        {
          id: "ocean-surface",
          type: "fill",
          source: "oceanSurface",
          paint: { "fill-color": "#d7e5eb", "fill-antialias": false },
        },
        {
          id: "land",
          type: "fill",
          source: "world",
          paint: { "fill-color": "#f7f8f4", "fill-outline-color": "#bccac8" },
        },
        {
          id: "province-fill",
          type: "fill",
          source: "provinces",
          paint: { "fill-color": "#f4f7f0", "fill-opacity": 0.75 },
        },
        {
          id: "province-line",
          type: "line",
          source: "provinces",
          paint: { "line-color": "#c5d2cb", "line-width": 0.6 },
        },
      ],
    },
    center: camera?.center || [108, 34],
    zoom: camera?.zoom ?? 3.25,
    bearing: camera?.bearing || 0,
    minZoom: 0.7,
    maxZoom: 12,
    attributionControl: false,
    canvasContextAttributes: { preserveDrawingBuffer: true },
    fadeDuration: 220,
  });
  map.addControl(
    new maplibregl.AttributionControl({
      compact: true,
      customAttribution: "Natural Earth / DataV · 演示位置，非实际地址",
    }),
    "bottom-right",
  );
  map.scrollZoom.setWheelZoomRate(1 / 280);
  map.scrollZoom.setZoomRate(1 / 80);
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  map.on("error", (event) => onError?.(event.error.message));
  map.on("moveend", () => {
    if (ready)
      onCamera?.({
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
      });
  });
  map.on("load", () => {
    ready = true;
    map.setProjection({ type: "globe" });
    map.setSky({
      "sky-color": "#f4f6f6",
      "horizon-color": "#dce8eb",
      "fog-color": "#e5edef",
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 3, 0],
    });
    const labelImage = (id, text, color = "#fff", size = 14) => {
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d");
      ctx.font = `600 ${size * 2}px system-ui`;
      canvas.width = Math.ceil(ctx.measureText(text).width) + 12;
      canvas.height = size * 3;
      ctx.font = `600 ${size * 2}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      if (id.startsWith("enterprise-")) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
      }
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      map.addImage(id, ctx.getImageData(0, 0, canvas.width, canvas.height), {
        pixelRatio: 2,
      });
    };
    for (let i = 2; i <= data.enterprises.length; i++)
      labelImage(`count-${i}`, String(i));
    for (const entity of data.enterprises)
      labelImage(
        `enterprise-${entity.id}`,
        enterpriseLabel(entity),
        "#3e5c4f",
        12,
      );
    map.addSource("entities", {
      type: "geojson",
      data: fc([]),
      cluster: true,
      clusterMaxZoom: 5,
      clusterRadius: 32,
      clusterProperties: { severity: ["max", ["get", "severity"]] },
    });
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "entities",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "match",
          ["get", "severity"],
          4,
          "#3c4147",
          3,
          "#ce6153",
          2,
          "#cf9c35",
          1,
          "#477eae",
          "#338575",
        ],
        "circle-radius": ["step", ["get", "point_count"], 16, 8, 22],
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 3,
      },
    });
    map.addLayer({
      id: "cluster-counts",
      type: "symbol",
      source: "entities",
      filter: ["has", "point_count"],
      layout: {
        "icon-image": [
          "concat",
          "count-",
          ["to-string", ["get", "point_count"]],
        ],
        "icon-allow-overlap": true,
      },
    });
    map.addLayer({
      id: "entity-halo",
      type: "circle",
      source: "entities",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-opacity": 0.14,
        "circle-radius": ["+", ["get", "radius"], 6],
      },
    });
    map.addLayer({
      id: "entity-points",
      type: "circle",
      source: "entities",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["get", "radius"],
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2.5,
        "circle-radius-transition": { duration: 220 },
        "circle-color-transition": { duration: 220 },
      },
    });
    map.addLayer({
      id: "enterprise-labels",
      type: "symbol",
      source: "entities",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["concat", "enterprise-", ["get", "id"]],
        "icon-offset": [0, 24],
        "icon-padding": 5,
      },
    });
    map.addLayer({
      id: "task-rings",
      type: "circle",
      source: "entities",
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "task"], true],
      ],
      paint: {
        "circle-color": "#fff",
        "circle-opacity": 0,
        "circle-radius": 16,
        "circle-stroke-color": "#5487aa",
        "circle-stroke-width": 2,
      },
    });
    map.addSource("selection", { type: "geojson", data: fc([]) });
    map.addLayer({
      id: "selection-ring",
      type: "circle",
      source: "selection",
      paint: {
        "circle-color": "#fff",
        "circle-opacity": 0,
        "circle-stroke-color": "#1e514a",
        "circle-stroke-width": 2,
        "circle-radius": 19,
      },
    });
    map.addSource("relations", { type: "geojson", data: fc([]) });
    map.addLayer({
      id: "relation-lines",
      type: "line",
      source: "relations",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 2,
        "line-opacity": 0.65,
        "line-dasharray": [3, 2],
      },
    });
    map.addSource("banks", { type: "geojson", data: fc([]) });
    map.addLayer({
      id: "bank-points",
      type: "circle",
      source: "banks",
      paint: {
        "circle-color": "#416d9c",
        "circle-radius": 7,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
      },
    });
    map.on("click", "entity-points", (event) => {
      if (performance.now() >= suppressClickUntil && event.features?.[0])
        onSelect("enterprise", event.features[0].properties.id);
    });
    map.on("click", "bank-points", (event) => {
      if (performance.now() >= suppressClickUntil && event.features?.[0])
        onSelect("bank", event.features[0].properties.id);
    });
    map.on("click", "clusters", async (event) => {
      if (performance.now() < suppressClickUntil) return;
      const feature = event.features?.[0];
      if (!feature) return;
      const source = map.getSource("entities");
      const coordinates = [...feature.geometry.coordinates],
        clusterId = feature.properties.cluster_id;
      try {
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: coordinates,
          zoom,
          duration: 700,
        });
      } catch (error) {
        onError?.(error.message);
      }
    });
    for (const layer of ["entity-points", "bank-points", "clusters"]) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = choosing ? "crosshair" : "";
      });
    }
    if (desired) update(...desired);
    container.dataset.mapReady = "true";
    if (!camera) fit();
  });
  function update(
    rows,
    {
      mode = "risk",
      selectedId = null,
      relationships = false,
      taskIds = [],
      plan = null,
      baselineRows = [],
    } = {},
  ) {
    selectionEpoch++;
    desired = [
      rows,
      { mode, selectedId, relationships, taskIds, plan, baselineRows },
    ];
    if (!ready) return;
    map.setFilter("enterprise-labels", [
      "all",
      ["!", ["has", "point_count"]],
      ["!=", ["get", "id"], selectedId || ""],
    ]);
    const colors = {
      绿灯: "#338575",
      黄灯: "#cf9c35",
      红灯: "#ce6153",
      黑灯: "#3c4147",
    };
    const points = rows.map((row) => {
      const color =
        mode === "cost"
          ? row.premium > 25
            ? "#ce6153"
            : row.premium > 0
              ? "#cf9c35"
              : "#338575"
          : mode === "maturity"
            ? row.gap > 0
              ? "#ce6153"
              : "#338575"
            : mode === "exposure"
              ? "#477eae"
              : colors[row.riskTier];
      return point(row.coordinates, {
        id: row.id,
        label: enterpriseLabel(row),
        name: row.name,
        color,
        severity:
          color === "#3c4147"
            ? 4
            : color === "#ce6153"
              ? 3
              : color === "#cf9c35"
                ? 2
                : color === "#477eae"
                  ? 1
                  : 0,
        radius:
          row.id === selectedId
            ? 10
            : Math.max(6, Math.min(11, 5 + Math.log10(row.balance + 1))),
        task: taskIds.includes(row.id),
      });
    });
    map.getSource("entities").setData(fc(points));
    const inScope = rows.find((row) => row.id === selectedId),
      outside = data.enterprises.find((row) => row.id === selectedId);
    const selected =
      inScope ||
      (outside
        ? {
            ...outside,
            bankIds: [
              ...new Set(
                data.loans
                  .filter(
                    (loan) =>
                      loan.enterpriseId === selectedId &&
                      loan.startDate <= data.asOf &&
                      loan.maturityDate > data.asOf,
                  )
                  .map((loan) => loan.bankId),
              ),
            ],
          }
        : null);
    map
      .getSource("selection")
      .setData(
        fc(selected ? [point(selected.coordinates, { id: selected.id })] : []),
      );
    const connections = [],
      bankPoints = [];
    if (relationships && selected) {
      for (const bankId of selected.bankIds) {
        const bank = data.banks.find((item) => item.id === bankId);
        connections.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [selected.coordinates, bank.coordinates],
          },
          properties: { color: "#5586aa", kind: "借款" },
        });
        bankPoints.push(
          point(bank.coordinates, { id: bank.id, name: bank.name }),
        );
      }
      for (const guarantee of data.guarantees.filter((item) =>
        [item.guarantorId, item.beneficiaryId].includes(selected.id),
      )) {
        const a = data.enterprises.find(
            (item) => item.id === guarantee.guarantorId,
          ),
          b = data.enterprises.find(
            (item) => item.id === guarantee.beneficiaryId,
          );
        connections.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [a.coordinates, b.coordinates],
          },
          properties: { color: "#b48a35", kind: "担保" },
        });
      }
    }
    map.getSource("relations").setData(fc(connections));
    map.getSource("banks").setData(fc(bankPoints));
    activePopup?.remove();
    activePopup = null;
    if (selected) {
      const label = document.createElement("div");
      label.className = "selected-map-label";
      label.textContent =
        enterpriseLabel(selected) + (inScope ? "" : "（当前范围外）");
      activePopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 18,
        anchor: "bottom",
        className: "entity-label",
      })
        .setLngLat(selected.coordinates)
        .setDOMContent(label)
        .addTo(map);
    }
  }
  function fit(ids = null) {
    const entities = ids
      ? data.enterprises.filter((entity) => ids.includes(entity.id))
      : data.enterprises;
    if (!entities.length) return;
    const bounds = new maplibregl.LngLatBounds();
    entities.forEach((entity) => bounds.extend(entity.coordinates));
    map.fitBounds(bounds, {
      padding: 70,
      duration: 850,
      maxZoom: entities.length === 1 ? 6 : 4.3,
    });
  }
  container.addEventListener(
    "pointerdown",
    (event) => {
      if (!choosing) return;
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      boxStart = [event.clientX - rect.left, event.clientY - rect.top];
      rectangle = document.createElement("div");
      rectangle.className = "map-selection-box";
      container.append(rectangle);
      container.setPointerCapture(event.pointerId);
    },
    true,
  );
  container.addEventListener("pointermove", (event) => {
    if (!boxStart || !rectangle) return;
    const rect = container.getBoundingClientRect(),
      x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    Object.assign(rectangle.style, {
      left: `${Math.min(x, boxStart[0])}px`,
      top: `${Math.min(y, boxStart[1])}px`,
      width: `${Math.abs(x - boxStart[0])}px`,
      height: `${Math.abs(y - boxStart[1])}px`,
    });
  });
  function finish(event, cancelled = false) {
    if (!boxStart) return;
    suppressClickUntil = performance.now() + 300;
    const rect = container.getBoundingClientRect(),
      end = [event.clientX - rect.left, event.clientY - rect.top],
      start = boxStart;
    rectangle?.remove();
    rectangle = null;
    boxStart = null;
    setChoosing(false);
    const epoch = selectionEpoch;
    if (
      !cancelled &&
      Math.abs(start[0] - end[0]) + Math.abs(start[1] - end[1]) > 8
    ) {
      const bounds = [
        [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
        [Math.max(start[0], end[0]), Math.max(start[1], end[1])],
      ];
      const features = map.queryRenderedFeatures(bounds, {
          layers: ["entity-points", "clusters"],
        }),
        ids = new Set();
      (async () => {
        for (const feature of features) {
          if (feature.properties.cluster_id !== undefined) {
            const leaves = await map
              .getSource("entities")
              .getClusterLeaves(feature.properties.cluster_id, 100, 0);
            leaves.forEach((leaf) => ids.add(leaf.properties.id));
          } else ids.add(feature.properties.id);
        }
        if (epoch === selectionEpoch) onBoxSelect([...ids]);
      })().catch((error) => {
        if (epoch === selectionEpoch) onError?.(error.message);
      });
    }
  }
  container.addEventListener("pointerup", (event) => finish(event));
  container.addEventListener("pointercancel", (event) => finish(event, true));
  function setChoosing(value) {
    selectionEpoch++;
    choosing = value;
    if (value) map.dragPan.disable();
    else {
      map.dragPan.enable();
      rectangle?.remove();
      rectangle = null;
      boxStart = null;
    }
    map.getCanvas().style.cursor = value ? "crosshair" : "";
    container.dataset.choosing = String(value);
    document
      .querySelector('[data-action="box-select"]')
      ?.setAttribute("aria-pressed", String(value));
  }
  return {
    map,
    update,
    fit,
    resize: () => map.resize(),
    zoom: (delta) =>
      map.easeTo({
        zoom: Math.max(0.7, Math.min(12, map.getZoom() + delta)),
        duration: 350,
      }),
    world: () =>
      map.flyTo({
        center: [103, 20],
        zoom: Math.max(
          0.7,
          0.8 +
            Math.log2(
              (Math.min(container.clientWidth, container.clientHeight) * 0.76) /
                270,
            ),
        ),
        pitch: 0,
        bearing: 0,
        duration: 1200,
      }),
    focus: (id) => {
      const entity = data.enterprises.find((item) => item.id === id);
      if (entity)
        map.flyTo({ center: entity.coordinates, zoom: 5.5, duration: 900 });
    },
    setChoosing,
    destroy: () => {
      selectionEpoch++;
      map.remove();
    },
  };
}
