/**
 * deck-stage.js — 1920×1080 HTML deck stage used by the first-round review.
 * Keyboard: ←/→, PgUp/PgDn, Space, Home/End, T thumbnails, F fullscreen, R reset.
 */
(() => {
  const interactive = 'a,button,input,select,textarea,summary,[role="button"],[contenteditable="true"]';

  class DeckStage extends HTMLElement {
    constructor() {
      super();
      this.index = 0;
      this.pending = [];
      this.railOpen = false;
      this.root = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.w = Number(this.getAttribute('width')) || 1920;
      this.h = Number(this.getAttribute('height')) || 1080;
      this.slides = [...this.children].filter((node) => node.tagName === 'SECTION');
      this.slides.forEach((slide, i) => {
        const label = slide.dataset.label || slide.querySelector('h1,h2')?.textContent?.trim() || `第 ${i + 1} 页`;
        slide.dataset.screenLabel = `${String(i + 1).padStart(2, '0')} ${label}`;
        slide.dataset.omValidate = 'no_overflowing_text,no_overlapping_text,slide_sized_text';
        Object.assign(slide.style, {
          position: 'absolute', inset: '0', width: `${this.w}px`, height: `${this.h}px`,
          margin: '0', overflow: 'hidden', visibility: 'hidden', opacity: '0'
        });
      });

      this.root.innerHTML = `
        <style>
          :host{position:fixed;inset:0;display:block;background:#080f18;color:#eaf2fb;overflow:hidden;font-family:"PingFang SC","Microsoft YaHei","Noto Sans SC",-apple-system,sans-serif}
          *{box-sizing:border-box}
          .shell{position:absolute;inset:0;display:grid;grid-template-columns:0 1fr;transition:grid-template-columns .18s ease}
          .shell.rail-open{grid-template-columns:300px 1fr}
          .rail{min-width:0;overflow:hidden;background:#0d1723;border-right:1px solid rgba(172,195,219,.18);z-index:5}
          .rail-inner{width:300px;height:100%;padding:22px 14px 86px;overflow:auto}
          .rail-title{padding:0 8px 14px;font-size:13px;letter-spacing:.12em;color:#8fa3b8}
          .thumb{width:100%;display:grid;grid-template-columns:34px 1fr;gap:9px;align-items:center;margin:0 0 8px;padding:10px 11px;border:1px solid transparent;border-radius:7px;background:transparent;color:#b8c7d6;text-align:left;cursor:pointer;font:500 13px/1.4 inherit}
          .thumb:hover{background:rgba(255,255,255,.05)}
          .thumb.active{color:#fff;border-color:rgba(72,169,230,.55);background:rgba(49,95,174,.25)}
          .thumb b{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#6f8499}
          .view{position:relative;min-width:0;overflow:hidden;background:#050a10}
          .canvas{position:absolute;left:50%;top:50%;width:${this.w}px;height:${this.h}px;transform-origin:center center;will-change:transform;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.42)}
          slot{display:block;width:100%;height:100%}
          .controls{position:absolute;z-index:8;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:6px;border:1px solid rgba(171,195,219,.22);border-radius:9px;background:rgba(10,18,28,.82);backdrop-filter:blur(14px);box-shadow:0 10px 36px rgba(0,0,0,.28);opacity:.24;transition:opacity .15s ease}
          .controls:hover,.controls:focus-within{opacity:1}
          .controls button{height:34px;min-width:38px;border:0;border-radius:6px;background:transparent;color:#dce7f2;cursor:pointer;font:600 13px/1 inherit}
          .controls button:hover{background:rgba(255,255,255,.09)}
          .counter{min-width:74px;text-align:center;color:#9eb0c2;font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace}
          .hint{position:absolute;right:18px;bottom:20px;color:#71879d;font:500 11px/1.4 inherit;letter-spacing:.04em}
          @media(max-width:760px){.shell.rail-open{grid-template-columns:0 1fr}.rail{display:none}.hint{display:none}}
          @media print{:host{position:static;background:#fff;overflow:visible}.shell,.view{display:block}.canvas{position:static;transform:none!important;box-shadow:none}.controls,.rail,.hint{display:none!important}}
        </style>
        <div class="shell">
          <aside class="rail" aria-label="页面缩略图"><div class="rail-inner"><div class="rail-title">页面导航</div><div class="thumbs"></div></div></aside>
          <main class="view">
            <div class="canvas"><slot></slot></div>
            <div class="controls" aria-label="演示控制">
              <button class="prev" title="上一页">←</button>
              <button class="rail-toggle" title="页面导航">目录</button>
              <span class="counter"></span>
              <button class="next" title="下一页">→</button>
              <button class="reset" title="回到首页">重置</button>
              <button class="full" title="全屏">全屏</button>
            </div>
            <div class="hint">← → 翻页 · T 目录 · F 全屏 · R 重置</div>
          </main>
        </div>`;

      this.shell = this.root.querySelector('.shell');
      this.view = this.root.querySelector('.view');
      this.canvas = this.root.querySelector('.canvas');
      this.counter = this.root.querySelector('.counter');
      this.thumbs = this.root.querySelector('.thumbs');
      this.buildRail();

      this.root.querySelector('.prev').addEventListener('click', () => this.prev());
      this.root.querySelector('.next').addEventListener('click', () => this.next());
      this.root.querySelector('.rail-toggle').addEventListener('click', () => this.toggleRail());
      this.root.querySelector('.reset').addEventListener('click', () => this.go(0, 'reset'));
      this.root.querySelector('.full').addEventListener('click', () => this.fullscreen());
      this._key = (event) => this.onKey(event);
      addEventListener('keydown', this._key);
      this._resize = new ResizeObserver(() => this.fit());
      this._resize.observe(this.view);
      this.addEventListener('click', (event) => {
        if (event.composedPath().some((node) => node.matches?.(interactive))) return;
        const x = event.clientX / innerWidth;
        if (x < .3) this.prev();
        else if (x > .7) this.next();
      });
      const deep = Number((location.hash.match(/(?:slide=)?(\d+)/) || [])[1]);
      this.go(Number.isFinite(deep) && deep > 0 ? Math.min(deep - 1, this.slides.length - 1) : 0, 'init');
      this.fit();
    }

    disconnectedCallback() {
      removeEventListener('keydown', this._key);
      this._resize?.disconnect();
    }

    buildRail() {
      this.thumbs.innerHTML = '';
      this.slides.forEach((slide, i) => {
        const button = document.createElement('button');
        button.className = 'thumb';
        button.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b><span>${slide.dataset.label || '页面'}</span>`;
        button.addEventListener('click', () => this.go(i, 'rail'));
        this.thumbs.append(button);
      });
    }

    fit() {
      if (!this.view) return;
      const scale = Math.min(this.view.clientWidth / this.w, this.view.clientHeight / this.h);
      this.canvas.style.transform = `translate(-50%,-50%) scale(${scale})`;
    }

    toggleRail(force) {
      this.railOpen = typeof force === 'boolean' ? force : !this.railOpen;
      this.shell.classList.toggle('rail-open', this.railOpen);
      requestAnimationFrame(() => this.fit());
      setTimeout(() => this.fit(), 200);
    }

    go(next, reason = 'api') {
      if (!this.slides.length) return;
      next = Math.max(0, Math.min(next, this.slides.length - 1));
      const previous = this.index;
      this.slides.forEach((slide, i) => {
        const active = i === next;
        slide.style.visibility = active ? 'visible' : 'hidden';
        slide.style.opacity = active ? '1' : '0';
        slide.toggleAttribute('data-deck-active', active);
        slide.setAttribute('aria-hidden', String(!active));
      });
      this.index = next;
      this.counter.textContent = `${String(next + 1).padStart(2, '0')} / ${String(this.slides.length).padStart(2, '0')}`;
      [...this.thumbs.children].forEach((button, i) => button.classList.toggle('active', i === next));
      history.replaceState(null, '', `${location.pathname}${location.search}#slide=${next + 1}`);
      this.prepareAnimations(this.slides[next], next < previous);
      this.dispatchEvent(new CustomEvent('slidechange', { bubbles: true, composed: true, detail: { index: next, previousIndex: previous, total: this.slides.length, slide: this.slides[next], reason } }));
    }

    prepareAnimations(slide, backwards) {
      slide.querySelectorAll('[data-anim]').forEach((el) => {
        el.getAnimations().forEach((anim) => anim.cancel());
        el.style.opacity = '';
        el.style.transform = '';
      });
      this.pending = [];
      if (backwards || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const items = [...slide.querySelectorAll('[data-anim]')].sort((a, b) => Number(a.dataset.animOrder || 0) - Number(b.dataset.animOrder || 0));
      const leadIn = [];
      const clickSteps = [];
      let currentStep = null;

      items.forEach((el, i) => {
        const trigger = el.dataset.animTrigger || 'after';
        el.style.opacity = '0';
        const item = { el, trigger, index: i };
        if (trigger === 'click') {
          currentStep = [item];
          clickSteps.push(currentStep);
        } else if (currentStep) {
          currentStep.push(item);
        } else {
          leadIn.push(item);
        }
      });

      leadIn.forEach(({ el, index }) => {
        const delay = Number(el.dataset.animDelay || index * 90);
        setTimeout(() => this.animate(el, 0), delay);
      });

      this.pending = clickSteps.map((step) => () => this.animateStep(step));
    }

    animateStep(step) {
      let previousStart = 0;
      let previousDuration = 0;
      step.forEach(({ el, trigger }, index) => {
        const ownDelay = Number(el.dataset.animDelay || 0);
        let start = ownDelay;
        if (index > 0 && trigger === 'with') start = previousStart + ownDelay;
        if (index > 0 && trigger === 'after') start = previousStart + previousDuration + ownDelay;
        this.animate(el, start);
        previousStart = start;
        previousDuration = Number(el.dataset.animDuration || 520);
      });
    }

    animate(el, delay = 0) {
      const kind = el.dataset.anim || 'fade-in';
      const duration = Number(el.dataset.animDuration || 520);
      const dir = el.dataset.animDir || 'bottom';
      const vector = { left: [-34, 0], right: [34, 0], top: [0, -28], bottom: [0, 28] }[dir] || [0, 20];
      let frames = [{ opacity: 0 }, { opacity: 1 }];
      if (kind.includes('fly') || kind.includes('float')) frames = [{ opacity: 0, transform: `translate(${vector[0]}px,${vector[1]}px)` }, { opacity: 1, transform: 'translate(0,0)' }];
      if (kind.includes('wipe')) frames = [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }];
      if (kind.includes('zoom')) frames = [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }];
      el.style.opacity = '1';
      el.animate(frames, { duration, delay, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'both' });
    }

    next() {
      if (this.pending.length) {
        const step = this.pending.shift();
        step();
        this.dispatchEvent(new CustomEvent('deckstep', { bubbles: true, composed: true }));
        return;
      }
      this.go(this.index + 1, 'next');
    }

    prev() { this.go(this.index - 1, 'prev'); }

    fullscreen() {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.();
    }

    onKey(event) {
      if (event.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); this.next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); this.prev(); }
      else if (event.key === 'Home') { event.preventDefault(); this.go(0, 'home'); }
      else if (event.key === 'End') { event.preventDefault(); this.go(this.slides.length - 1, 'end'); }
      else if (event.key.toLowerCase() === 't') this.toggleRail();
      else if (event.key.toLowerCase() === 'f') this.fullscreen();
      else if (event.key.toLowerCase() === 'r') this.go(0, 'reset');
    }
  }

  if (!customElements.get('deck-stage')) customElements.define('deck-stage', DeckStage);
})();
