import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

// Worker servi depuis public/ (copié depuis pdfjs-dist) — évite tout CDN externe.
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const ZOOM = [1, 1.5, 2, 3];

// Affiche la 1re page d'un PDF sur un canvas et laisse poser des épingles dessus.
// Les coordonnées des épingles sont en % (indépendantes du zoom).
export default function PlanPdf({ url, pins = [], onTapPlan }) {
  const canvasRef = useRef();
  const viewportRef = useRef();
  const [zi, setZi] = useState(0);
  const [etat, setEtat] = useState("load"); // load | ok | erreur

  useEffect(() => {
    let cancel = false;
    setEtat("load");
    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        if (cancel) return;
        const base = page.getViewport({ scale: 1 });
        const scale = 1500 / base.width; // rendu net, redimensionné en CSS ensuite
        const vp = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
        if (!cancel) setEtat("ok");
      } catch (e) {
        console.error("PDF:", e);
        if (!cancel) setEtat("erreur");
      }
    })();
    return () => { cancel = true; };
  }, [url]);

  const tap = useCallback((e) => {
    if (e.ctrlKey) return; // Ctrl = déplacement, pas d'épingle
    const r = e.currentTarget.getBoundingClientRect();
    onTapPlan?.(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  }, [onTapPlan]);

  // Ctrl + glisser = main pour se déplacer ; Ctrl + molette = zoom
  useEffect(() => {
    const v = viewportRef.current;
    if (!v) return;
    let pan = false, sx, sy, sl, st;
    const down = (e) => { if (!e.ctrlKey) return; pan = true; sx = e.clientX; sy = e.clientY; sl = v.scrollLeft; st = v.scrollTop; document.body.style.cursor = "grabbing"; e.preventDefault(); };
    const move = (e) => { if (!pan) return; v.scrollLeft = sl - (e.clientX - sx); v.scrollTop = st - (e.clientY - sy); };
    const up = () => { if (pan) { pan = false; document.body.style.cursor = ""; } };
    const wheel = (e) => { if (!e.ctrlKey) return; e.preventDefault(); setZi((z) => Math.max(0, Math.min(ZOOM.length - 1, z + (e.deltaY < 0 ? 1 : -1)))); };
    v.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    v.addEventListener("wheel", wheel, { passive: false });
    return () => { v.removeEventListener("mousedown", down); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); v.removeEventListener("wheel", wheel); };
  }, []);

  const w = ZOOM[zi] * 100;
  return (
    <div>
      <div className="pv-planbar">
        <span className="pv-hint">📍 Cliquez le plan pour situer votre remarque</span>
        <div className="pv-zoom">
          <button type="button" onClick={() => setZi((z) => Math.max(0, z - 1))} title="Dézoomer">−</button>
          <span className="pv-zlbl">{Math.round(w)}%</span>
          <button type="button" onClick={() => setZi((z) => Math.min(ZOOM.length - 1, z + 1))} title="Zoomer">＋</button>
          <button type="button" onClick={() => setZi(0)} title="Réinitialiser">⟲</button>
        </div>
      </div>
      <div className="pv-viewport" ref={viewportRef} title="Ctrl + molette : zoom · Ctrl + glisser : déplacer">
        <div className="pv-plan" style={{ width: w + "%" }}>
          <canvas ref={canvasRef} className="pv-canvas" />
          <div className="pv-pinlayer" onClick={tap} />
          {pins.map((p, i) => (
            <div key={i} className="pv-pin" style={{ left: p.x + "%", top: p.y + "%" }}>
              <svg viewBox="0 0 24 24"><path fill="#FC6C1B" d="M12 0C6.5 0 2 4.4 2 9.9 2 17 12 24 12 24s10-7 10-14.1C22 4.4 17.5 0 12 0z" /></svg>
              <span>{i + 1}</span>
            </div>
          ))}
          {etat !== "ok" && (
            <div className="pv-planmsg">{etat === "load" ? "Chargement du plan…" : "Impossible d'afficher le plan."}</div>
          )}
        </div>
      </div>
    </div>
  );
}
