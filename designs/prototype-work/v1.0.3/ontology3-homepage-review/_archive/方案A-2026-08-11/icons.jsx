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
    brand: <svg {...common}><path d="M12 2 20 7 12 12 4 7 12 2Z"/><path d="M4 7v10l8 5 8-5V7"/><path d="M12 12v10"/></svg>,
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
