"use client";

import { useEffect, useRef, useState } from "react";

export type SnipResult = {
  selector: string;
  bbox: { x: number; y: number; w: number; h: number };
  dataUrl: string;
};

export function SnipOverlay({ onSnip, onCancel }: { onSnip: (r: SnipResult) => void; onCancel: () => void }) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onCancel]);

  function rect() {
    if (!start || !end) return null;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    return { x, y, w, h };
  }

  async function finalize() {
    const r = rect();
    if (!r || r.w < 10 || r.h < 10) { onCancel(); return; }

    // best-effort selector: pick the element at the center of the rect
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    // hide overlay momentarily so elementFromPoint and the screenshot see through
    if (ref.current) ref.current.style.display = "none";
    const el = document.elementFromPoint(cx, cy);
    const selector = el ? cssPath(el as Element) : "(unknown)";

    let dataUrl = "";
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(document.body, {
        x: r.x + window.scrollX,
        y: r.y + window.scrollY,
        width: r.w,
        height: r.h,
        backgroundColor: null,
        useCORS: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2)
      });
      dataUrl = canvas.toDataURL("image/png");
    } catch (e) {
      dataUrl = makePlaceholder(r.w, r.h, selector);
    } finally {
      if (ref.current) ref.current.style.display = "";
    }

    onSnip({ selector, bbox: r, dataUrl });
  }

  const r = rect();

  return (
    <div
      ref={ref}
      onMouseDown={e => { setStart({ x: e.clientX, y: e.clientY }); setEnd({ x: e.clientX, y: e.clientY }); }}
      onMouseMove={e => { if (start) setEnd({ x: e.clientX, y: e.clientY }); }}
      onMouseUp={() => { if (start && end) finalize(); }}
      onTouchStart={e => { const t = e.touches[0]; setStart({ x: t.clientX, y: t.clientY }); setEnd({ x: t.clientX, y: t.clientY }); }}
      onTouchMove={e => { const t = e.touches[0]; if (start) setEnd({ x: t.clientX, y: t.clientY }); }}
      onTouchEnd={() => { if (start && end) finalize(); }}
      className="fixed inset-0 z-[60] cursor-crosshair bg-black/40"
    >
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-white/95 px-3 py-1.5 text-sm shadow dark:bg-ink-900/95">
        Drag to snip a region — Esc to cancel
      </div>
      {r && (
        <div
          className="absolute border-2 border-accent bg-accent/10"
          style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
        />
      )}
    </div>
  );
}

function cssPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.nodeType === 1 && depth < 6) {
    let part = cur.tagName.toLowerCase();
    const id = (cur as HTMLElement).id;
    if (id) { part += "#" + id; parts.unshift(part); break; }
    const cls = (cur as HTMLElement).className;
    if (typeof cls === "string" && cls.trim()) {
      const first = cls.trim().split(/\s+/)[0];
      if (first && !/^[0-9]/.test(first)) part += "." + CSS.escape(first);
    }
    const sib = cur.parentElement ? Array.from(cur.parentElement.children).filter(c => c.tagName === cur!.tagName) : [];
    if (sib.length > 1) part += `:nth-of-type(${sib.indexOf(cur) + 1})`;
    parts.unshift(part);
    cur = cur.parentElement;
    depth++;
  }
  return parts.join(" > ");
}

function makePlaceholder(w: number, h: number, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${Math.min(w, 200)}' height='${Math.min(h, 100)}'><rect width='100%' height='100%' fill='#e7e5e4'/><text x='50%' y='50%' fill='#57534e' font-family='sans-serif' font-size='10' text-anchor='middle'>snip</text></svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}
