(function installInlineMap(global) {
  'use strict';
  function mount(container, { point, initial, onChange }) {
    const d3 = global.d3;
    if (!container || !d3) return () => {};
    const svg = d3.select(container.querySelector('svg'));
    const world = svg.select('[data-map-world]');
    const markers = [...container.querySelectorAll('[data-map-marker]')].map(node => ({
      node, point: [Number(node.dataset.pointX), Number(node.dataset.pointY)],
      halfWidth: node.querySelector('text').getComputedTextLength() / 2 + 5
    }));
    const labels = [...container.querySelectorAll('[data-map-province]')].map(node => ({
      node, point: [Number(node.dataset.x), Number(node.dataset.y)],
      halfWidth: node.querySelector('text').getComputedTextLength() / 2 + 3
    })).sort((a, b) => Math.hypot(a.point[0] - point[0], a.point[1] - point[1]) - Math.hypot(b.point[0] - point[0], b.point[1] - point[1]));
    let width = svg.node().clientWidth || 600, height = svg.node().clientHeight || 320;
    let ratio = width / 600;
    // Saved camera coordinates use the fixed source projection, independent of screen size.
    let camera = initial && [initial.k, initial.x, initial.y].every(Number.isFinite)
      ? { ...initial, k: Math.max(1, Math.min(24, initial.k)) }
      : { k: 4, x: 300 - point[0] * 4, y: 160 - point[1] * 4 };
    const rounded = value => Number(value.toFixed(6));
    const zoom = d3.zoom().extent(() => [[0, 0], [width, height]])
      .scaleExtent([ratio, 24 * ratio]).translateExtent([[-100, -80], [700, 400]])
      .on('zoom', event => {
        const t = event.transform, level = t.k / ratio;
        world.attr('transform', t);
        const occupied = markers.map(marker => {
          const position = t.apply(marker.point);
          marker.node.setAttribute('transform', `translate(${position.join(' ')})`);
          return [position[0] - marker.halfWidth, position[1] - 30, position[0] + marker.halfWidth, position[1] + 12];
        });
        for (const label of labels) {
          const position = t.apply(label.point);
          const bounds = [position[0] - label.halfWidth, position[1] - 12, position[0] + label.halfWidth, position[1] + 4];
          const visible = level >= 2 && bounds[0] >= 4 && bounds[2] <= width - 4 && bounds[1] >= 4 && bounds[3] <= height - 4
            && !occupied.some(box => bounds[0] < box[2] && bounds[2] > box[0] && bounds[1] < box[3] && bounds[3] > box[1]);
          label.node.setAttribute('transform', `translate(${position.join(' ')})`);
          label.node.style.display = visible ? '' : 'none';
          if (visible) occupied.push(bounds);
        }
        camera = { k: rounded(level), x: rounded(300 - (width / 2 - t.x) / ratio), y: rounded(160 - (height / 2 - t.y) / ratio) };
        Object.assign(container.dataset, { scale: String(camera.k), x: String(camera.x), y: String(camera.y) });
        container.querySelector('[data-map-scale]').textContent = `${level.toFixed(1)}×`;
      })
      .on('end', () => onChange?.({ ...camera }));
    const apply = value => {
      svg.attr('viewBox', `0 0 ${width} ${height}`);
      svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2 - (300 - value.x) * ratio, height / 2 - (160 - value.y) * ratio).scale(value.k * ratio));
    };
    const locate = (k = camera.k) => apply({ k, x: 300 - point[0] * k, y: 160 - point[1] * k });
    svg.call(zoom);
    apply(camera);
    const controls = [...container.querySelectorAll('[data-inline-map]')];
    const controlClick = event => {
      const action = event.currentTarget.dataset.inlineMap;
      if (action === 'locate') locate();
      else if (action === 'reset') apply({ k: 1, x: 0, y: 0 });
      else if (action === 'fit') {
        const xs=markers.map(marker=>marker.point[0]),ys=markers.map(marker=>marker.point[1]);
        const k=Math.max(1,Math.min(12,(width-70)/ratio/Math.max(1,Math.max(...xs)-Math.min(...xs)),(height-80)/ratio/Math.max(1,Math.max(...ys)-Math.min(...ys))));
        apply({k,x:300-(Math.max(...xs)+Math.min(...xs))/2*k,y:160-(Math.max(...ys)+Math.min(...ys))/2*k});
      }
      else svg.call(zoom.scaleBy, action === 'in' ? 1.5 : 1 / 1.5);
    };
    controls.forEach(button => button.addEventListener('click', controlClick));
    const wheel = event => event.preventDefault();
    svg.node().addEventListener('wheel', wheel, { passive: false });
    const keydown = event => {
      if (!['+', '=', '-', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Home') { locate(4); return; }
      if (['+', '=', '-'].includes(event.key)) { svg.call(zoom.scaleBy, event.key === '-' ? 1 / 1.5 : 1.5); return; }
      const k = d3.zoomTransform(svg.node()).k;
      svg.call(zoom.translateBy, event.key === 'ArrowLeft' ? 30 / k : event.key === 'ArrowRight' ? -30 / k : 0,
        event.key === 'ArrowUp' ? 30 / k : event.key === 'ArrowDown' ? -30 / k : 0);
    };
    svg.node().addEventListener('keydown', keydown);
    const resize = new ResizeObserver(() => {
      const nextWidth = svg.node().clientWidth, nextHeight = svg.node().clientHeight;
      if (!nextWidth || !nextHeight || nextWidth === width && nextHeight === height) return;
      const saved = { ...camera };
      width = nextWidth; height = nextHeight; ratio = width / 600;
      zoom.scaleExtent([ratio, 24 * ratio]); apply(saved);
    });
    resize.observe(svg.node());
    const focus = event => {
      const marker=markers.find(entry=>entry.node.dataset.mapObject===event.detail.id);
      if(marker)apply({k:camera.k,x:300-marker.point[0]*camera.k,y:160-marker.point[1]*camera.k});
      markers.forEach(entry=>entry.node.classList.toggle('selected',entry===marker));
    };
    container.addEventListener('ofw-map-focus',focus);
    return () => {
      resize.disconnect(); svg.on('.zoom', null);
      container.removeEventListener('ofw-map-focus',focus);
      controls.forEach(button => button.removeEventListener('click', controlClick));
      svg.node().removeEventListener('wheel', wheel); svg.node().removeEventListener('keydown', keydown);
    };
  }
  global.OFW_M07_INLINE_MAP = Object.freeze({ mount });
})(window);
