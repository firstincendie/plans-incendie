import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import { supabase } from "../../supabase";

// Worker servi depuis public/ (copié depuis pdfjs-dist) — évite tout CDN externe.
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const ZOOM = [1, 1.5, 2, 3];

// Affiche la 1re page d'un PDF sur un canvas et laisse poser des épingles dessus.
// Les coordonnées des épingles sont en % (indépendantes du zoom).
// Expose snapshot() via ref : renvoie un dataURL PNG du plan AVEC les épingles.
const PlanPdf = forwardRef(function PlanPdf({ url, pins = [], onTapPlan, onMovePin }, ref) {
  const canvasRef = useRef();
  const viewportRef = useRef();
  const pinLayerRef = useRef();
  const dragRef = useRef(null);   // index de l'épingle déplacée
  const movedRef = useRef(false); // vrai si un glissement vient d'avoir lieu
  const [zi, setZi] = useState(0);
  const [etat, setEtat] = useState("load"); // load | ok | erreur

  // Déplacement d'une épingle par glisser (souris + tactile via Pointer Events)
  useEffect(() => {
    function move(e) {
      if (dragRef.current == null) return;
      const layer = pinLayerRef.current; if (!layer) return;
      const r = layer.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      movedRef.current = true;
      onMovePin?.(dragRef.current, x, y);
    }
    function up() {
      if (dragRef.current != null) { dragRef.current = null; document.body.style.cursor = ""; setTimeout(() => { movedRef.current = false; }, 0); }
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [onMovePin]);

  useImperativeHandle(ref, () => ({
    // Compose le canvas du plan + les épingles numérotées en une image PNG.
    snapshot() {
      const src = canvasRef.current;
      if (!src || etat !== "ok") return null;
      const out = document.createElement("canvas");
      out.width = src.width; out.height = src.height;
      const ctx = out.getContext("2d");
      ctx.drawImage(src, 0, 0);
      const r = Math.max(16, out.width * 0.014);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.round(r * 1.1)}px 'Segoe UI', sans-serif`;
      pins.forEach((p, i) => {
        const x = (p.x / 100) * out.width;
        const y = (p.y / 100) * out.height;
        const cy = y - r * 1.3;
        // pointe
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - r * 0.6, cy); ctx.lineTo(x + r * 0.6, cy);
        ctx.closePath(); ctx.fillStyle = "#E4560A"; ctx.fill();
        // pastille
        ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "#FC6C1B"; ctx.fill();
        ctx.lineWidth = Math.max(2, r * 0.14); ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.fillText(String(i + 1), x, cy);
      });
      return out.toDataURL("image/png");
    },
  }), [pins, etat]);

  useEffect(() => {
    if (!url) { setEtat("erreur"); return; }
    let cancel = false;
    setEtat("load");
    (async () => {
      try {
        // On télécharge le fichier via le client Supabase (CORS OK) plutôt que de
        // laisser pdf.js le chercher lui-même (requêtes "range" mal supportées).
        let blob = null;
        const marker = "/storage/v1/object/public/fichiers/";
        const i = url.indexOf(marker);
        if (i >= 0) {
          const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
          const res = await supabase.storage.from("fichiers").download(path);
          if (res.error) throw res.error;
          blob = res.data;
        } else {
          blob = await (await fetch(url)).blob();
        }
        if (cancel) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const isPdf = (blob.type || "").includes("pdf") || /\.pdf(\?|$)/i.test(url);

        if (isPdf) {
          const buf = await blob.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
          const page = await pdf.getPage(1);
          if (cancel) return;
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: 1500 / base.width });
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
        } else {
          // Image : on la dessine sur le canvas (objectURL local → pas de canvas "taint")
          const objUrl = URL.createObjectURL(blob);
          const img = new Image();
          await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = objUrl; });
          if (cancel) { URL.revokeObjectURL(objUrl); return; }
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d").drawImage(img, 0, 0);
          URL.revokeObjectURL(objUrl);
        }
        if (!cancel) setEtat("ok");
      } catch (e) {
        console.error("Plan:", e);
        if (!cancel) setEtat("erreur");
      }
    })();
    return () => { cancel = true; };
  }, [url]);

  const tap = useCallback((e) => {
    if (e.ctrlKey) return; // Ctrl = déplacement, pas d'épingle
    if (movedRef.current) { movedRef.current = false; return; } // on vient de glisser une épingle
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
          <div className="pv-pinlayer" ref={pinLayerRef} onClick={tap} />
          {pins.map((p, i) => (
            <div key={i} className="pv-pin" style={{ left: p.x + "%", top: p.y + "%" }}
              title="Glissez pour déplacer"
              onPointerDown={(e) => { if (e.ctrlKey) return; e.stopPropagation(); dragRef.current = i; movedRef.current = false; document.body.style.cursor = "grabbing"; }}>
              <svg viewBox="0 0 24 24"><path fill="#FC6C1B" d="M12 0C6.5 0 2 4.4 2 9.9 2 17 12 24 12 24s10-7 10-14.1C22 4.4 17.5 0 12 0z" /></svg>
              <span>{i + 1}</span>
            </div>
          ))}
          {etat !== "ok" && (
            <div className="pv-planmsg">
              {etat === "load" ? "Chargement du plan…" : (
                <span>Impossible d'afficher le plan.{url ? <> <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB", fontWeight: 700 }}>Ouvrir le fichier</a></> : null}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PlanPdf;
