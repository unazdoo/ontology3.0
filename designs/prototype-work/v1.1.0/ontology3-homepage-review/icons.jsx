function Icon({ name, size = 18, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": "true"
  };

  const icons = {
    brand: <svg {...common} className={`${className} brand-neural-icon`.trim()}>
      <path className="brand-neural-outline" d="M12 3.2C10.6 1.9 8.1 2.2 7.1 3.9 4.8 3.8 3.4 6 4.2 8 2.5 9.2 2.8 12 4.6 13 3.8 15.3 5.4 17.6 7.7 17.7 8.4 20.1 11.2 21 12 18.7c.8 2.3 3.6 1.4 4.3-1 2.3-.1 3.9-2.4 3.1-4.7 1.8-1 2.1-3.8.4-5 .8-2-0.6-4.2-2.9-4.1-1-1.7-3.5-2-4.9-.7Z"/>
      <path className="brand-neural-edge" d="M12 3.2 8.5 5.1 5.2 7.5l3.2 3.1-2.7 4 3.9 1.7 2.4 2.4m0-15.5 3.5 1.9 3.3 2.4-3.2 3.1 2.7 4-3.9 1.7-2.4 2.4M8.5 5.1l3.5 3 3.5-3M8.4 10.6l3.6-2.5 3.6 2.5-3.6 3.1-3.6-3.1Zm1.2 5.7 2.4-2.6 2.4 2.6"/>
      <path className="brand-neural-signal signal-a" pathLength="1" d="M5.2 7.5 8.4 10.6 12 13.7 14.4 16.3"/>
      <path className="brand-neural-signal signal-b" pathLength="1" d="M18.8 7.5 15.6 10.6 12 8.1 8.5 5.1"/>
      <circle className="brand-neural-node phase-a" cx="12" cy="3.2" r=".55"/><circle className="brand-neural-node phase-b" cx="8.5" cy="5.1" r=".48"/><circle className="brand-neural-node phase-c" cx="15.5" cy="5.1" r=".48"/><circle className="brand-neural-node phase-d" cx="5.2" cy="7.5" r=".48"/><circle className="brand-neural-node phase-a key" cx="12" cy="8.1" r=".58"/><circle className="brand-neural-node phase-b" cx="18.8" cy="7.5" r=".48"/><circle className="brand-neural-node phase-c" cx="8.4" cy="10.6" r=".5"/><circle className="brand-neural-node phase-d" cx="15.6" cy="10.6" r=".5"/><circle className="brand-neural-node phase-a key" cx="12" cy="13.7" r=".58"/><circle className="brand-neural-node phase-b" cx="5.7" cy="14.6" r=".48"/><circle className="brand-neural-node phase-c" cx="18.3" cy="14.6" r=".48"/><circle className="brand-neural-node phase-d" cx="9.6" cy="16.3" r=".48"/><circle className="brand-neural-node phase-a" cx="14.4" cy="16.3" r=".48"/><circle className="brand-neural-node phase-c key" cx="12" cy="18.7" r=".55"/>
    </svg>,
    home: <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>,
    info: <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>,
    pipeline: <svg {...common}><path d="M4 5h5v5H4zM15 14h5v5h-5zM15 4h5v5h-5zM4 15h5v5H4z"/><path d="m9 7.5 6-1M9 17.5l6-1M12 8v8"/></svg>,
    ontology: <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="8.5" y="14" width="7" height="7"/><path d="M10 7h4M7 10v2l5 2m5-4v2l-5 2"/></svg>,
    query: <svg {...common}><circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 5 5M7 10h6M10 7v6"/></svg>,
    decision: <svg {...common}><path d="M4 4h16v11H8l-4 4V4Z"/><path d="M8 8h8M8 11h5"/><path d="m16.5 16 1.5 1.5 3-3"/></svg>,
    agent: <svg {...common}><circle cx="12" cy="12" r="3"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><circle cx="5" cy="18" r="2"/><path d="m7 8 3 2m4 0 3-3m-3 7 3 3m-7-3-3 3"/></svg>,
    report: <svg {...common}><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h4M8 12h8M8 16h8M8 8h3"/></svg>,
    database: <svg {...common}><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/></svg>,
    insight: <svg {...common}><path d="M4 19V9m5 10V5m6 14v-7m5 7V3"/><path d="m3 13 6-5 6 2 6-6"/></svg>,
    action: <svg {...common}><circle cx="12" cy="12" r="3"/><circle cx="4" cy="7" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="20" cy="19" r="2"/><circle cx="4" cy="19" r="2"/><path d="m6 8 3.5 2m5 0 3.5-4m-3.5 8 3.5 4m-8.5-4L6 18"/></svg>,
    search: <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>,
    bell: <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>,
    chevron: <svg {...common}><path d="m9 6 6 6-6 6"/></svg>,
    arrow: <svg {...common}><path d="M5 12h14m-5-5 5 5-5 5"/></svg>,
    back: <svg {...common}><path d="M19 12H5m5 5-5-5 5-5"/></svg>,
    close: <svg {...common}><path d="m6 6 12 12M18 6 6 18"/></svg>,
    expand: <svg {...common}><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m18 0v5h-5"/></svg>,
    collapse: <svg {...common}><path d="m9 4-5 5 5 5M15 20l5-5-5-5"/></svg>,
    status: <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
    history: <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/></svg>,
    filter: <svg {...common}><path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/></svg>,
    check: <svg {...common}><path d="m5 12 4 4L19 6"/></svg>,
    external: <svg {...common}><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/></svg>,
    more: <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>
  };

  return icons[name] || icons.info;
}

Object.assign(window, { Icon });
