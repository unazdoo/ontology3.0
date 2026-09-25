import {mapContext} from './map-context.js';
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {viewSignal,signalColor,greatCircleGeometry,greatCirclePoint} from "./exploration-view.js";
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
  onClearSelection,
  onContextMenu,
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
  let flowTimer=null,flowRoutes=[],flowKey="",playedFlowKey="",visible=true;
  const stopFlow=()=>{clearTimeout(flowTimer);flowTimer=null;if(ready&&map.getSource("relation-flow"))map.getSource("relation-flow").setData(fc([]));};
  function playFlow(force=false){
    if(!ready||!visible||document.hidden||!flowRoutes.length||(!force&&flowKey===playedFlowKey))return;
    stopFlow();playedFlowKey=flowKey;const started=performance.now();
    const tick=()=>{if(!visible||document.hidden){stopFlow();return;}const progress=(performance.now()-started)/2400;if(progress>=1){stopFlow();return;}map.getSource("relation-flow").setData(fc(flowRoutes.map(route=>point(greatCirclePoint(route[0],route[1],1-progress),{}))));flowTimer=setTimeout(tick,60);};tick();
  }
  const visibility=()=>{if(document.hidden)stopFlow();};
  document.addEventListener("visibilitychange",visibility);
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
          paint: { "background-color": "#07182b" },
        },
        {
          id: "ocean-surface",
          type: "fill",
          source: "oceanSurface",
          paint: { "fill-color": "#0d263e", "fill-antialias": false },
        },
        {
          id: "land",
          type: "fill",
          source: "world",
          paint: { "fill-color": "#17364e", "fill-outline-color": "#41647b" },
        },
        {
          id: "province-fill",
          type: "fill",
          source: "provinces",
          paint: { "fill-color": "#1d4059", "fill-opacity": 0.75 },
        },
        {
          id: "province-line",
          type: "line",
          source: "provinces",
          paint: { "line-color": "#54768b", "line-width": 0.6 },
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
      "sky-color": "#07182b",
      "horizon-color": "#244760",
      "fog-color": "#102e46",
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
      if (id.startsWith("enterprise-") || id.startsWith("bank-")) {
        ctx.strokeStyle = "#102b42";
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
      }
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      map.addImage(id, ctx.getImageData(0, 0, canvas.width, canvas.height), {
        pixelRatio: 2,
      });
    };
    const entityIcon=(kind)=>{const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;const c=canvas.getContext('2d');c.strokeStyle=kind==='bank'?'#23629a':'#256e67';c.lineWidth=2.6;c.lineJoin='round';c.lineCap='round';
      if(kind==='bank'){c.beginPath();c.moveTo(7,15);c.lineTo(20,7);c.lineTo(33,15);c.closePath();c.stroke();for(const x of [11,20,29]){c.beginPath();c.moveTo(x,19);c.lineTo(x,29);c.stroke();}c.beginPath();c.moveTo(7,33);c.lineTo(33,33);c.stroke();}
      else {c.strokeRect(11,7,19,27);for(const x of [16,24])for(const y of [13,19,25])c.fillRect(x,y,2,2);c.beginPath();c.moveTo(18,34);c.lineTo(18,29);c.lineTo(23,29);c.lineTo(23,34);c.stroke();}map.addImage(kind+'-symbol',c.getImageData(0,0,40,40),{pixelRatio:2});};entityIcon('enterprise');entityIcon('bank');
    for (let i = 2; i <= data.enterprises.length; i++)
      labelImage(`count-${i}`, String(i));
    for (const entity of data.enterprises)
      labelImage(
        `enterprise-${entity.id}`,
        enterpriseLabel(entity),
        "#d9edf8",
        12,
      );
    for(const bank of data.banks)labelImage(`bank-${bank.id}`,bank.name,"#b4daf6",11);
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
        "circle-color": "#ffffff",
        "circle-radius": 13,
        "circle-stroke-color": ["get","color"],
        "circle-stroke-width": 2,
        "circle-radius-transition": { duration: 220 },
        "circle-color-transition": { duration: 220 },
      },
    });
    map.addLayer({id:'entity-icons',type:'symbol',source:'entities',filter:['!', ['has','point_count']],layout:{'icon-image':'enterprise-symbol','icon-allow-overlap':true}});
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
        "line-width": 2.5,
        "line-opacity": 0.8,
      },
    });
    map.setFilter('relation-lines',['!=',['get','kind'],'担保']);
    map.addLayer({id:'guarantee-lines',type:'line',source:'relations',filter:['==',['get','kind'],'担保'],paint:{'line-color':'#b18c40','line-width':2.5,'line-opacity':.9,'line-dasharray':[3,2]}});
    map.addSource("banks", { type: "geojson", data: fc([]) });
    map.addLayer({
      id: "bank-points",
      type: "circle",
      source: "banks",
      paint: {
        "circle-color": "#eef7ff",
        "circle-radius": 14,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
      },
    });
    map.addLayer({id:'bank-icons',type:'symbol',source:'banks',layout:{'icon-image':'bank-symbol','icon-allow-overlap':true,'icon-ignore-placement':true}});
    map.addSource('focus-entities',{type:'geojson',data:fc([])});
    map.addLayer({id:'focus-entity-points',type:'circle',source:'focus-entities',paint:{'circle-color':'#fff','circle-radius':15,'circle-stroke-color':['get','color'],'circle-stroke-width':2}});
    map.addLayer({id:'focus-entity-icons',type:'symbol',source:'focus-entities',layout:{'icon-image':'enterprise-symbol','icon-allow-overlap':true,'icon-ignore-placement':true}});
    map.addLayer({id:'focus-entity-labels',type:'symbol',source:'focus-entities',layout:{'icon-image':['concat','enterprise-',['get','id']],'icon-offset':[0,27],'icon-allow-overlap':true,'icon-ignore-placement':true}});
    map.addLayer({id:"bank-labels",type:"symbol",source:"banks",layout:{"icon-image":["concat","bank-",["get","id"]],"icon-anchor":"bottom","icon-offset":[0,-12],"icon-allow-overlap":true,"icon-ignore-placement":true}});
    map.addSource("relation-flow",{type:"geojson",data:fc([])});
    map.addLayer({id:"relation-flow",type:"circle",source:"relation-flow",paint:{"circle-radius":4.5,"circle-color":"#2676b6","circle-stroke-color":"white","circle-stroke-width":2}});
    const hitAt=event=>map.queryRenderedFeatures(event.point,{layers:['focus-entity-icons','focus-entity-points','bank-icons','bank-points','entity-icons','entity-points','clusters']})[0];
    map.on('click',async event=>{
      if(choosing||performance.now()<suppressClickUntil)return;
      const hit=hitAt(event);if(!hit){onClearSelection?.();return;}
      if(hit.properties.cluster_id!=null){try{const zoom=await map.getSource('entities').getClusterExpansionZoom(hit.properties.cluster_id);map.easeTo({center:hit.geometry.coordinates,zoom,duration:350});}catch(error){onError?.(error.message);}return;}
      if(hit.properties.id)onSelect(hit.properties.id.startsWith('BANK-')?'bank':'enterprise',hit.properties.id);
    });
    map.on('contextmenu',event=>{const hit=hitAt(event);if(!hit?.properties.id)return;event.originalEvent.preventDefault();onContextMenu?.({type:hit.properties.id.startsWith('BANK-')?'bank':'enterprise',id:hit.properties.id,x:event.originalEvent.clientX,y:event.originalEvent.clientY});});
    for (const layer of ["entity-points", "bank-points", "clusters","entity-icons","focus-entity-icons","bank-icons"]) {
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
      selectedBankId = null,
      relationships = false,
      relationTypes=['financing'],
      taskIds = [],
      plan = null,
      baselineRows = [],
    } = {},
  ) {
    selectionEpoch++;
    desired = [
      rows,
      { mode, selectedId, selectedBankId, relationships, relationTypes,taskIds, plan, baselineRows },
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
      const color=signalColor((row.viewSignal||viewSignal(row,mode,data)).tone);
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
        fc(selectedBankId ? data.banks.filter(b=>b.id===selectedBankId).map(b=>point(b.coordinates,{id:b.id})) : selected ? [point(selected.coordinates, { id: selected.id })] : []),
      );
    const context=mapContext(data,rows,{selectedId,selectedBankId,relationships,relationTypes});map.setFilter('focus-entity-labels',['!=',['get','id'],selectedId||'']);
    const connections=context.edges.map(edge=>({type:'Feature',geometry:greatCircleGeometry(edge.fromCoordinates,edge.toCoordinates),properties:{...edge,fromCoordinates:undefined,toCoordinates:undefined,color:edge.kind==='担保'?'#b18936':'#5282ac'}}));
    map.getSource('relations').setData(fc(connections));
    map.getSource('banks').setData(fc(context.banks.map(bank=>point(bank.coordinates,{id:bank.id,name:bank.name,selected:bank.id===selectedBankId}))));
    map.getSource('focus-entities').setData(fc(context.enterprises.map(entity=>point(entity.coordinates,{id:entity.id,contextOnly:entity.contextOnly,color:entity.id===selectedId&&!selectedBankId?'#087f87':rows.some(r=>r.id===entity.id)?signalColor((rows.find(r=>r.id===entity.id).viewSignal||viewSignal(rows.find(r=>r.id===entity.id),mode,data)).tone):'#789dad'}))));
    const opacity=context.focused?.22:1;
    for(const layer of ['entity-points','clusters'])map.setPaintProperty(layer,'circle-opacity',opacity);
    map.setPaintProperty('entity-points','circle-stroke-opacity',opacity);map.setPaintProperty('clusters','circle-stroke-opacity',opacity);
    map.setPaintProperty('entity-halo','circle-opacity',context.focused?.035:.14);
    for(const layer of ['entity-icons','enterprise-labels','cluster-counts'])map.setPaintProperty(layer,'icon-opacity',opacity);
    flowRoutes=context.edges.filter(e=>e.kind!=='担保').map(e=>[e.fromCoordinates,e.toCoordinates]);
    flowKey=(selectedBankId||selectedId||'global')+':'+relationships+':'+relationTypes.join(',');if(!context.focused)stopFlow();else playFlow();
    container.dataset.relatedEnterprises=context.enterprises.length;container.dataset.relatedBanks=context.banks.length;container.dataset.relatedGuarantees=context.edges.filter(e=>e.kind==='担保').length;
    activePopup?.remove();
    activePopup = null;
    if (selected && !selectedBankId) {
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
    setVisible(value){visible=value;if(!value)stopFlow();else playFlow();},
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
      const entity = [...data.enterprises,...data.banks].find((item) => item.id === id);
      if (entity) {
        const bankIds=new Set(data.loans.filter(loan=>loan.enterpriseId===id&&loan.startDate<=data.asOf&&loan.maturityDate>data.asOf).map(loan=>loan.bankId));
        const context=mapContext(data,desired?.[0]||data.enterprises,id.startsWith('BANK-')?{selectedBankId:id,relationTypes:desired?.[1]?.relationTypes}:{selectedId:id,relationTypes:desired?.[1]?.relationTypes});const points=[entity.coordinates,...context.banks.map(bank=>bank.coordinates),...context.enterprises.map(e=>e.coordinates)];
        const bounds=new maplibregl.LngLatBounds();points.forEach(point=>bounds.extend(point));
        map.fitBounds(bounds,{padding:75,maxZoom:5,duration:850});playFlow(true);
      }
    },
    setChoosing,
    destroy: () => {
      selectionEpoch++;
      stopFlow();document.removeEventListener("visibilitychange",visibility);
      map.remove();
    },
  };
}
