import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import PlanPdf from "./validation/PlanPdf";
import "./validation/validation.css";

const ETAPES = [
  { key: "step1", cap: "Infos" },
  { key: "step2", cap: "Pièces" },
  { key: "step3", cap: "Équip." },
];

export default function PageValidation() {
  const { token } = useParams();
  const [chargement, setChargement] = useState(true);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [ecran, setEcran] = useState("home"); // home|step1|step2|step3|recap|done|envoi
  const [envoye, setEnvoye] = useState(null);  // resultat submit

  // --- Étape 1 ---
  const [societe, setSociete] = useState("");
  const [adresse, setAdresse] = useState("");
  const [editSoc, setEditSoc] = useState(false);
  const [editAdr, setEditAdr] = useState(false);
  const [logo, setLogo] = useState(null); // {nom, url}
  const [com1, setCom1] = useState("");
  const [ok1, setOk1] = useState(false);
  const origSoc = useMemo(() => data?.commande?.client_societe || "", [data]);
  const origAdr = useMemo(() => {
    const c = data?.commande;
    if (!c) return "";
    const l1 = [c.numero_rue, c.adresse1].filter(Boolean).join(" ");
    const l2 = [c.code_postal, c.ville].filter(Boolean).join(" ");
    return [l1, l2].filter(Boolean).join("\n");
  }, [data]);

  // --- Étapes 2 & 3 ---
  const [pins2, setPins2] = useState([]);
  const [pins3, setPins3] = useState([]);
  const [com2, setCom2] = useState("");
  const [com3, setCom3] = useState("");
  const [ok2, setOk2] = useState(false);
  const [ok3, setOk3] = useState(false);

  // Chargement initial via le jeton
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: res, error } = await supabase.rpc("validation_charger", { p_token: token });
      if (cancel) return;
      if (error) { setErreur("erreur_reseau"); setChargement(false); return; }
      if (res?.error) { setErreur(res.error); setChargement(false); return; }
      setData(res);
      setSociete(res.commande?.client_societe || "");
      const c = res.commande;
      const l1 = [c?.numero_rue, c?.adresse1].filter(Boolean).join(" ");
      const l2 = [c?.code_postal, c?.ville].filter(Boolean).join(" ");
      setAdresse([l1, l2].filter(Boolean).join("\n"));
      setChargement(false);
    })();
    return () => { cancel = true; };
  }, [token]);

  // Curseur main quand Ctrl est enfoncé (déplacement du plan)
  useEffect(() => {
    const dn = (e) => { if (e.key === "Control") document.body.classList.add("pv-ctrl"); };
    const up = (e) => { if (e.key === "Control") document.body.classList.remove("pv-ctrl"); };
    const blur = () => document.body.classList.remove("pv-ctrl");
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  // Détection auto des modifications
  const chg1 = societe !== origSoc || adresse !== origAdr || !!logo || com1.trim() !== "";
  const chg2 = pins2.length > 0 || com2.trim() !== "";
  const chg3 = pins3.length > 0 || com3.trim() !== "";
  const pins2Incomplet = pins2.filter((p) => !p.texte.trim()).length;
  const pins3Incomplet = pins3.filter((p) => !p.texte.trim()).length;

  const cta1Ok = chg1 || ok1;
  const cta2Ok = pins2Incomplet === 0 && (chg2 || ok2);
  const cta3Ok = pins3Incomplet === 0 && (chg3 || ok3);

  const tapPlan = (setter) => (x, y) => setter((prev) => [...prev, { x, y, texte: "" }]);

  const planUrl = useMemo(() => {
    const f = (data?.planFiles || []).find((x) => (x.type || "").includes("pdf") || (x.nom || "").toLowerCase().endsWith(".pdf")) || (data?.planFiles || [])[0];
    return f?.url || null;
  }, [data]);

  const previewLogo = useCallback((input) => {
    const f = input.files && input.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = (e) => setLogo({ nom: f.name, url: e.target.result });
    rd.readAsDataURL(f);
  }, []);

  async function envoyer() {
    setEcran("envoi");
    const dataInfos = {};
    if (societe !== origSoc) dataInfos.societe = societe;
    if (adresse !== origAdr) dataInfos.adresse = adresse;
    if (logo) dataInfos.logo = logo;
    const reponses = [
      { etape: "infos", statut: chg1 ? "modifs" : "ok", commentaire: com1.trim() || null, data: Object.keys(dataInfos).length ? dataInfos : null },
      { etape: "pieces", statut: chg2 ? "modifs" : "ok", commentaire: com2.trim() || null, data: null },
      { etape: "equipements", statut: chg3 ? "modifs" : "ok", commentaire: com3.trim() || null, data: null },
    ];
    const epingles = [
      ...pins2.map((p, i) => ({ etape: "pieces", numero: i + 1, page: 1, x: p.x, y: p.y, texte: p.texte })),
      ...pins3.map((p, i) => ({ etape: "equipements", numero: i + 1, page: 1, x: p.x, y: p.y, texte: p.texte })),
    ];
    const { data: res, error } = await supabase.rpc("validation_soumettre", { p_token: token, p_reponses: reponses, p_epingles: epingles });
    if (error || res?.error) { setEcran("recap"); alert("Échec de l'envoi. Merci de réessayer."); return; }
    setEnvoye(res);
    setEcran("done");
  }

  if (chargement) return <div className="pv-root"><div className="pv-full">Chargement…</div></div>;
  if (erreur) {
    const msg = erreur === "lien_expire" ? "Ce lien de validation a expiré." : "Ce lien de validation est invalide ou a été révoqué.";
    return <div className="pv-root"><div className="pv-full"><div style={{ fontSize: 40 }}>🔗</div><div style={{ fontWeight: 700, color: "#122131", fontSize: 16 }}>{msg}</div><div>Contactez votre société de sécurité incendie pour obtenir un nouveau lien.</div></div></div>;
  }

  const c = data.commande;
  const emet = data.emettrice || {};
  const emetNom = [emet.prenom, emet.nom].filter(Boolean).join(" ");
  const emetSociete = emet.entreprise || "Sécurité incendie";
  const stepIndex = { step1: 1, step2: 2, step3: 3 }[ecran] || (ecran === "recap" ? 4 : 0);

  return (
    <div className="pv-root">
      <div className="pv-topbar">
        {ecran !== "home" && ecran !== "done" && (
          <button className="pv-back" onClick={() => setEcran(back(ecran))}>‹</button>
        )}
        <div className="pv-mark">🔥</div>
        <div style={{ flex: 1 }}>
          <div className="pv-brand">{emetSociete}</div>
          <div className="pv-sub">Espace de validation</div>
        </div>
      </div>

      <div className="pv-body">
        {ecran === "home" && (
          <div className="pv-wrap narrow">
            <div className="pv-hello">Bonjour{data.prenom ? " " : ""}<b>{data.prenom || ""}</b> 👋</div>
            <h1 className="pv-lead">Votre plan est prêt à être validé</h1>
            <p className="pv-leadsub">La société <b>{emetSociete}</b> a préparé le plan de sécurité incendie de votre établissement <b>{c.client_societe || c.nom_plan}</b> et vous le transmet pour validation.<br /><br />Vérifiez-le, puis validez-le ou signalez les points à corriger — c'est simple et rapide.</p>

            <div className="pv-seclabel">Les plans de votre commande</div>
            <div className="pv-tablewrap">
              <table className="pv-table">
                <thead><tr><th>N°</th><th>Type de plan</th><th>Emplacement</th><th>Orientation</th><th>Format</th><th>Matière</th></tr></thead>
                <tbody>
                  {(c.plans || []).map((p, i) => (
                    <tr key={i}>
                      <td>{p.numero || i + 1}</td>
                      <td>{p.type || "—"}</td>
                      <td>{p.emplacement || "—"}</td>
                      <td>{p.orientation || "—"}</td>
                      <td>{p.format || "—"}</td>
                      <td>{p.matiere || "—"}</td>
                    </tr>
                  ))}
                  {(!c.plans || c.plans.length === 0) && <tr><td colSpan={6} style={{ color: "#8798A8", fontWeight: 500 }}>—</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="pv-cmdnote">Tous les emplacements (extincteurs, issues de secours, alarmes…) figurent sur le plan que vous allez valider.</p>

            <button className="pv-cta center" onClick={() => setEcran("step1")}>Commencer la validation →</button>

            <ContactCard emet={emet} nom={emetNom} societe={emetSociete} />
          </div>
        )}

        {(ecran === "step1" || ecran === "step2" || ecran === "step3" || ecran === "recap") && (
          <div className={"pv-wrap" + (ecran === "step1" || ecran === "recap" ? " narrow" : "")}>
            <Progress index={stepIndex} />

            {ecran === "step1" && (
              <>
                <h2 className="pv-steptitle">Vérifiez vos informations</h2>
                <p className="pv-stephint">Elles apparaîtront sur le plan final. Cliquez « ✎ » si une info est à corriger.</p>
                <div className="pv-info">
                  <FieldRow label="Société" val={societe} orig={origSoc} editing={editSoc}
                    onEdit={() => setEditSoc(true)} onCommit={() => setEditSoc(false)} onChange={setSociete} />
                  <FieldRow label="Adresse" val={adresse} orig={origAdr} editing={editAdr} multiline
                    onEdit={() => setEditAdr(true)} onCommit={() => setEditAdr(false)} onChange={setAdresse} />
                </div>
                <LogoBox logo={logo} onPick={previewLogo} onRemove={() => setLogo(null)} />
                <div className="pv-comlabel">Un commentaire à ajouter ? (optionnel)</div>
                <textarea className="pv-note" value={com1} onChange={(e) => setCom1(e.target.value)} placeholder={`Une précision pour ${emetSociete}…`} />
                <Gate has={chg1} ok={ok1} setOk={setOk1} societe={emetSociete} />
                <button className="pv-cta" disabled={!cta1Ok} onClick={() => setEcran("step2")}>Continuer</button>
              </>
            )}

            {ecran === "step2" && (
              <>
                <h2 className="pv-steptitle">Cloisons et noms des pièces</h2>
                <p className="pv-stephint">Un détail à changer ? Cliquez l'endroit exact sur le plan pour y poser une épingle.</p>
                <div className="pv-cols">
                  <div className="pv-colmain"><PlanPdf url={planUrl} pins={pins2} onTapPlan={tapPlan(setPins2)} /></div>
                  <div className="pv-colside">
                    {pins2.length === 0 && <div className="pv-bubble">💡 Ajoutez une remarque en cliquant simplement sur le plan.</div>}
                    <PinList pins={pins2} setPins={setPins2} />
                    <div className="pv-sidebottom">
                      <div className="pv-comlabel">Autre remarque ? (optionnel)</div>
                      <textarea className="pv-note" value={com2} onChange={(e) => setCom2(e.target.value)} placeholder="Un commentaire général sur cette étape…" />
                      <Gate has={chg2} ok={ok2} setOk={setOk2} societe={emetSociete} incomplet={pins2Incomplet} />
                      <button className="pv-cta" disabled={!cta2Ok} onClick={() => setEcran("step3")}>Continuer</button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {ecran === "step3" && (
              <>
                <h2 className="pv-steptitle">Emplacement des équipements</h2>
                <p className="pv-stephint">Extincteurs, issues de secours, alarmes… Cliquez le plan pour signaler un déplacement.</p>
                <div className="pv-cols">
                  <div className="pv-colmain"><PlanPdf url={planUrl} pins={pins3} onTapPlan={tapPlan(setPins3)} /></div>
                  <div className="pv-colside">
                    {pins3.length === 0 && <div className="pv-bubble">💡 Ajoutez une remarque en cliquant simplement sur le plan.</div>}
                    <PinList pins={pins3} setPins={setPins3} />
                    <div className="pv-sidebottom">
                      <div className="pv-comlabel">Autre remarque ? (optionnel)</div>
                      <textarea className="pv-note" value={com3} onChange={(e) => setCom3(e.target.value)} placeholder="Un commentaire général sur cette étape…" />
                      <Gate has={chg3} ok={ok3} setOk={setOk3} societe={emetSociete} incomplet={pins3Incomplet} />
                      <button className="pv-cta" disabled={!cta3Ok} onClick={() => setEcran("recap")}>Voir le récapitulatif</button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {ecran === "recap" && (
              <>
                <h2 className="pv-steptitle">Récapitulatif</h2>
                <p className="pv-stephint">Voici ce qui sera transmis à {emetSociete}. Vous pouvez encore tout revoir.</p>
                <div className="pv-rcard">
                  <RecapRow titre="Informations" mod={chg1} sub={recapInfos(chg1, societe, origSoc, adresse, origAdr, logo, com1)} />
                  <RecapRow titre="Cloisons & pièces" mod={chg2} sub={recapPins(chg2, pins2, com2)} />
                  <RecapRow titre="Équipements" mod={chg3} sub={recapPins(chg3, pins3, com3)} />
                </div>
                <button className="pv-cta dark" onClick={envoyer}>Envoyer ma réponse</button>
                <button className="pv-ghost" onClick={() => setEcran("step1")}>Revoir depuis le début</button>
              </>
            )}
          </div>
        )}

        {ecran === "envoi" && <div className="pv-full">Envoi en cours…</div>}

        {ecran === "done" && (
          <div className="pv-wrap narrow">
            <div className="pv-confirm">
              <div className="pv-check">✓</div>
              {envoye?.statut === "valide" ? (
                <>
                  <h2>Plan validé, merci ! 🎉</h2>
                  <p>{emetSociete} est notifié que le plan est validé de votre côté et finalise avec le dessinateur.</p>
                  <div className="pv-cbadge">✅ Plan validé par le client</div>
                </>
              ) : (
                <>
                  <h2>Merci, c'est envoyé !</h2>
                  <p>Vos remarques ont été transmises à {emetSociete}. Vous recevrez un email dès qu'une nouvelle version corrigée sera prête à valider.</p>
                  <div className="pv-cbadge">📨 Modifications transmises</div>
                </>
              )}
              <div style={{ marginTop: 20, fontSize: 12, color: "#5B6B7B", lineHeight: 1.6 }}>
                Une question ? <b style={{ color: "#122131" }}>{emetSociete}{emetNom ? " · " + emetNom : ""}</b>
                {emet.telephone && <><br /><a href={`tel:${emet.telephone}`} style={{ color: "#FC6C1B", textDecoration: "none", fontWeight: 600 }}>{emet.telephone}</a></>}
                {emet.email && <> · <a href={`mailto:${emet.email}`} style={{ color: "#FC6C1B", textDecoration: "none", fontWeight: 600 }}>{emet.email}</a></>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function back(ecran) {
  return { step1: "home", step2: "step1", step3: "step2", recap: "step3" }[ecran] || "home";
}

function Progress({ index }) {
  return (
    <div className="pv-progress">
      {ETAPES.map((e, i) => {
        const n = i + 1, done = index > n, cur = index === n;
        return (
          <div key={e.key} style={{ display: "contents" }}>
            <div className="pv-pnode">
              <div className={"pv-pdot" + (done ? " done" : cur ? " cur" : "")}>{done ? "✓" : n}</div>
              <div className="pv-pcap">{e.cap}</div>
            </div>
            {i < ETAPES.length - 1 && <div className={"pv-pbar" + (index > n ? " done" : "")} />}
          </div>
        );
      })}
    </div>
  );
}

function FieldRow({ label, val, orig, editing, multiline, onEdit, onCommit, onChange }) {
  const changed = val !== orig;
  return (
    <div className="pv-frow">
      <div className="pv-fk">{label}</div>
      <div className="pv-fright">
        {editing ? (
          <div className="pv-editrow">
            {multiline
              ? <textarea className="pv-inp" autoFocus value={val} onChange={(e) => onChange(e.target.value)} />
              : <input className="pv-inp" autoFocus value={val} onChange={(e) => onChange(e.target.value)} />}
            <button className="pv-okedit" onClick={onCommit} title="Valider">✓</button>
          </div>
        ) : (
          <>
            <div className="pv-fval">{val.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}</div>
            {changed && <div className="pv-edited">✍️ Modifié</div>}
            <button className="pv-editbtn" onClick={onEdit} title="Modifier">✎</button>
          </>
        )}
      </div>
    </div>
  );
}

function LogoBox({ logo, onPick, onRemove }) {
  return (
    <div className="pv-logobox">
      {logo ? (
        <>
          <img className="pv-logoimg" src={logo.url} alt="logo" />
          <div className="s" style={{ color: "#067A5A", fontWeight: 700, marginTop: 8 }}>✓ Logo ajouté</div>
          <button className="pv-logodel" onClick={onRemove}>🗑 Supprimer le logo</button>
        </>
      ) : (
        <>
          <div className="ic">🖼️</div>
          <div className="t">Ajouter votre logo</div>
          <div className="s">Intégré au cartouche du plan (optionnel)</div>
          <label className="pv-logobtn">Choisir un fichier<input type="file" accept="image/*" onChange={(e) => onPick(e.target)} /></label>
        </>
      )}
    </div>
  );
}

function PinList({ pins, setPins }) {
  const setText = (i, v) => setPins((prev) => prev.map((p, idx) => idx === i ? { ...p, texte: v } : p));
  const del = (i) => setPins((prev) => prev.filter((_, idx) => idx !== i));
  if (pins.length === 0) return null;
  return (
    <div className="pv-pinlist">
      {pins.map((p, i) => (
        <div className="pv-pinitem" key={i}>
          <div className="pv-pinnum">{i + 1}</div>
          <input placeholder="Décrivez la modification… (obligatoire)" value={p.texte} onChange={(e) => setText(i, e.target.value)} />
          <button className="pv-pindel" onClick={() => del(i)} title="Retirer">✕</button>
        </div>
      ))}
    </div>
  );
}

function Gate({ has, ok, setOk, societe, incomplet }) {
  if (incomplet > 0) {
    return <div className="pv-modnote pv-warnnote">📍 Décrivez chaque épingle pour continuer — {incomplet} à compléter.</div>;
  }
  if (has) {
    return <div className="pv-modnote">✍️ Des modifications ont été détectées — elles seront transmises à {societe}.</div>;
  }
  return (
    <div className={"pv-checkline" + (ok ? " on" : "")} onClick={() => setOk(!ok)}>
      <div className="pv-checkbox">{ok ? "✓" : ""}</div>
      <div><div className="pv-clt">Tout est correct</div><div className="pv-cls">Je confirme, rien à changer sur cette étape</div></div>
    </div>
  );
}

function RecapRow({ titre, mod, sub }) {
  return (
    <div className="pv-rrow">
      <div className={"pv-rico " + (mod ? "mod" : "ok")}>{mod ? "✍️" : "✓"}</div>
      <div><div className="pv-rt">{titre}</div><div className="pv-rs">{sub}</div></div>
      <div className={"pv-rstat " + (mod ? "mod" : "ok")}>{mod ? "Modifs" : "OK"}</div>
    </div>
  );
}

function recapInfos(chg, soc, origSoc, adr, origAdr, logo, com) {
  if (!chg) return "Validé sans changement";
  const p = [];
  if (soc !== origSoc) p.push("Société corrigée");
  if (adr !== origAdr) p.push("Adresse corrigée");
  if (logo) p.push("Logo ajouté");
  if (com.trim()) p.push("Commentaire");
  return p.join(" · ");
}
function recapPins(chg, pins, com) {
  if (!chg) return "Validé sans changement";
  const parts = [];
  if (pins.length) parts.push(`${pins.length} épingle${pins.length > 1 ? "s" : ""}`);
  if (com.trim()) parts.push("commentaire");
  return parts.join(" · ");
}

function ContactCard({ emet, nom, societe }) {
  return (
    <div className="pv-contact">
      <div className="pv-cchead">
        <div className="pv-ccic">🔥</div>
        <div><div className="pv-cct">Une question sur vos plans ?</div><div className="pv-ccs">Contactez votre société de sécurité incendie</div></div>
      </div>
      <div className="pv-ccname">{societe}{nom ? " · " + nom : ""}</div>
      <div className="pv-cclines">
        {emet.telephone && <a href={`tel:${emet.telephone}`}>📞 {emet.telephone}</a>}
        {emet.email && <a href={`mailto:${emet.email}`}>✉️ {emet.email}</a>}
        {(emet.adresse || emet.ville) && <span>📍 {[emet.adresse, [emet.code_postal, emet.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>}
      </div>
    </div>
  );
}
