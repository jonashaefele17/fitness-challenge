// 3D-Muskelfigur: lädt das Z-Anatomy-Muskelmodell (CC BY-SA 4.0), hängt es an ein einfaches
// Skelett und färbt Muskelgruppen ein. Posen entstehen aus Zielpunkten für Hand und Fuß.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const stufe = (a, b, v) => THREE.MathUtils.smoothstep(v, a, b);

export const FARBEN = { koerper: 0x9a9ca6, primaer: 0xc5f04a, sekundaer: 0x7d9638, sehne: 0xc9cbd2, haut: 0xaeb0b9, hose: 0x26272c, hosePrimaer: 0x8fb031, hoseSekundaer: 0x4f6424 };
// Hosenbereich -> Muskelgruppe darunter
const HOSE_GRUPPE = [["abduktoren", /hip region/i], ["gesaess", /gluteal/i], ["adduktoren", /femoral triangle/i]];
// Von der Hautschicht des Modells werden nur Kopf, Hände, Füße und die Hose verwendet.
const HAUT_HAND = /palm|of hand|region of wrist|radial foveola|nail plate.[lr]/i;
const HAUT_FUSS = /foot|sole|heel|malleol|region of ankle|hallucial|metatarsal region/i;
const HAUT_AUS = /hairs|eyelash|cornea/i;
const HAUT_HOSE = /hip region|gluteal|inguinal|hypogastric|femoral triangle|anal region|sacral region|region of thigh/i;
const HOSE_SAUM = 0.67; // Höhe des Hosensaums in der Ruhehaltung (Meter)

// Behält nur die Dreiecke, deren Eckpunkte alle oberhalb von "grenze" liegen.
function oberhalb(geo, grenze) {
  const pos = geo.attributes.position, alt = geo.index.array, neu = [];
  for (let i = 0; i < alt.length; i += 3)
    if (pos.getY(alt[i]) > grenze && pos.getY(alt[i + 1]) > grenze && pos.getY(alt[i + 2]) > grenze) neu.push(alt[i], alt[i + 1], alt[i + 2]);
  geo.setIndex(neu);
}

// Gelenke in der Ruhehaltung des Modells (Meter, Y nach oben, Z nach vorn).
const GELENKE = { torso: V(0, 0, 0), kopf: V(0, 1.47, -0.025) };
for (const s of [-1, 1]) Object.assign(GELENKE, {
  ["oberarm" + s]: V(s * 0.17, 1.385, -0.03), ["unterarm" + s]: V(s * 0.225, 1.10, -0.025),
  ["hand" + s]: V(s * 0.272, 0.856, 0.005), ["finger" + s]: V(s * 0.289, 0.766, 0.02), ["spitzen" + s]: V(s * 0.295, 0.716, 0.022),
  ["daumen" + s]: V(s * 0.298, 0.845, 0.012), ["schulter" + s]: V(s * 0.17, 1.385, -0.03), ["huefte" + s]: V(s * 0.08, 0.85, -0.03),
  ["oberschenkel" + s]: V(s * 0.08, 0.85, -0.03), ["unterschenkel" + s]: V(s * 0.085, 0.43, -0.025), ["fuss" + s]: V(s * 0.075, 0.075, -0.035)
});

// Muskelname (Z-Anatomy) -> Muskelgruppe der App
const GRUPPEN = [
  ["brust", /pectoralis major/i], ["hintere-schulter", /scapular spinal part of deltoid/i], ["schulter", /deltoid/i], ["trizeps", /triceps brachii/i],
  ["bizeps", /biceps brachii|brachialis/i], ["unterarm", /brachioradialis|carpi|digitorum (superficialis|profundus)|pronator teres|palmaris longus/i],
  ["bauch", /rectus abdominis/i], ["seitlicher-bauch", /(external|internal) oblique|abdominal (external|internal)/i],
  ["nacken", /trapezius/i], ["oberer-ruecken", /rhomboid|teres major|infraspinatus/i], ["ruecken", /latissimus/i], ["unterer-ruecken", /iliocostalis|longissimus/i],
  ["abduktoren", /gluteus (medius|minimus)|tensor fasciae/i], ["adduktoren", /adductor (longus|brevis|magnus|minimus)|gracilis|pectineus/i], ["gesaess", /gluteus/i], ["quadrizeps", /rectus femoris|vastus/i], ["beinbeuger", /biceps femoris|semitendinosus|semimembranosus/i],
  ["waden", /gastrocnemius|soleus/i]
];
// "schulter" färbt auch die hintere Schulter, "ruecken" auch den oberen Rücken
const OBERGRUPPE = { "hintere-schulter": "schulter", "oberer-ruecken": "ruecken", "abduktoren": "gesaess" };
const enthaelt = (liste, g) => liste.includes(g) || liste.includes(OBERGRUPPE[g]);
const gruppeVon = name => (GRUPPEN.find(([, re]) => re.test(name)) || [null])[0];

const ARM = /deltoid|biceps brachii|brachialis|triceps brachii|coracobrachialis|anconeus|brachioradialis|humerus|radius|ulna|carpal|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|palm|of hand|region of wrist|radial foveola|nail plate.[lr]/i;
const ARM_GRUPPE = /forearm|hand|compartment of arm/i;
const BEIN = /gluteus|tensor fasciae|adductor magnus|extensor digitorum longus|femur|patella|tibia|fibula|tarsal|calcaneus|talus|navicular|cuneiform|cuboid|foot|sole|heel|malleol|region of ankle|hallucial|metatarsal region|region of thigh|femoral triangle|gluteal|hip region|inguinal/i;
const FINGER_ZEH = /phalanx|phalang|sesamoid/i;
const BEIN_GRUPPE = /thigh|of leg|foot|gluteal|hallucis|iliopsoas/i;
const DAUMEN_AB = 0.3;
const SCHULTERGUERTEL = /pectoralis major|latissimus|teres|infraspinatus|supraspinatus|subscapularis/i;

// Verteilt jeden Punkt eines Muskels auf höchstens zwei Knochen; rund um ein Gelenk wird weich überblendet.
function gewichte(geo, name, gruppe, index) {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const mitte = geo.boundingBox.getCenter(V(0, 0, 0)), s = mitte.x < 0 ? -1 : 1;
  const arm = mitte.y > 0.6 && (ARM.test(name) || ARM_GRUPPE.test(gruppe) || FINGER_ZEH.test(name));
  const bein = !arm && mitte.y < 0.98 && (BEIN.test(name) || BEIN_GRUPPE.test(gruppe) || FINGER_ZEH.test(name));
  const guertel = SCHULTERGUERTEL.test(name);
  const y0 = k => GELENKE[k + s].y;
  const idx = new Uint16Array(pos.count * 4), gew = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const x = Math.abs(pos.getX(i)), y = pos.getY(i);
    let a = "torso", b = "torso", w = 0; // w = Anteil von b
    // u = 0 gehört ganz zum Rumpf, u = 1 ganz zur Gliedmaße; dazwischen übernimmt der Hilfsknochen
    const ueber = (u, hilf, glied) => { if (u < 0.5) { b = hilf; w = u * 2; } else { a = hilf; b = glied; w = (u - 0.5) * 2; } };
    if (y > 1.44 && mitte.y > 1.43) { b = "kopf"; w = stufe(1.44, 1.51, y); }
    else if (arm) {
      if (y > y0("unterarm") + 0.07) ueber(Math.max(stufe(0.09, 0.25, x), 1 - stufe(y0("oberarm") - 0.19, y0("oberarm") - 0.03, y)), "schulter" + s, "oberarm" + s);
      else if (y > 0.5 * (y0("unterarm") + y0("hand"))) { a = "oberarm" + s; b = "unterarm" + s; w = 1 - stufe(y0("unterarm") - 0.04, y0("unterarm") + 0.035, y); }
      else if (y > 0.5 * (y0("hand") + y0("finger"))) { a = "unterarm" + s; b = "hand" + s; w = 1 - stufe(y0("hand") - 0.03, y0("hand") + 0.035, y); }
      else if (y > 0.5 * (y0("finger") + y0("spitzen"))) { a = "hand" + s; b = "finger" + s; w = 1 - stufe(y0("finger") - 0.018, y0("finger") + 0.02, y); }
      else { a = "finger" + s; b = "spitzen" + s; w = 1 - stufe(y0("spitzen") - 0.016, y0("spitzen") + 0.02, y); }
      if (x > DAUMEN_AB && y < 0.872 && y > 0.74) { a = "hand" + s; b = "daumen" + s; w = stufe(DAUMEN_AB, DAUMEN_AB + 0.018, x); } // Daumen steht seitlich ab
    } else if (bein) {
      if (y > 0.5 * (y0("oberschenkel") + y0("unterschenkel")) + 0.08) ueber(1 - stufe(y0("oberschenkel") - 0.14, y0("oberschenkel") + 0.10, y), "huefte" + s, "oberschenkel" + s);
      else if (y > 0.5 * (y0("unterschenkel") + y0("fuss"))) { a = "oberschenkel" + s; b = "unterschenkel" + s; w = 1 - stufe(y0("unterschenkel") - 0.03, y0("unterschenkel") + 0.04, y); }
      else { a = "unterschenkel" + s; b = "fuss" + s; w = 1 - stufe(y0("fuss") - 0.01, y0("fuss") + 0.055, y); }
    } else if (guertel) ueber(stufe(0.08, 0.25, x) * (/latissimus|teres/i.test(name) ? 0.5 : 0.74), "schulter" + s, "oberarm" + s); // Rückenmuskeln folgen dem Arm nur halb
    idx[i * 4] = index[a]; idx[i * 4 + 1] = index[b]; gew[i * 4] = 1 - w; gew[i * 4 + 1] = w;
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(gew, 4));
}

export async function ladeFigur(muskelUrl, hautUrl) {
  const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/");
  const lader = new GLTFLoader().setDRACOLoader(draco);
  const dateien = await Promise.all([muskelUrl, hautUrl].filter(Boolean).map(u => lader.loadAsync(u)));
  const wurzel = new THREE.Group(), knochen = {}, liste = [], index = {};
  for (const [name, ruhe] of Object.entries(GELENKE)) {
    const b = new THREE.Bone(); b.name = name; b.position.copy(ruhe);
    index[name] = liste.length; liste.push(b); knochen[name] = b; wurzel.add(b);
  }
  wurzel.updateMatrixWorld(true);
  const skelett = new THREE.Skeleton(liste);
  const material = {}, teile = [];
  for (const [k, farbe] of Object.entries(FARBEN)) material[k] = new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.82, metalness: 0 });
  const quellen = [];
  dateien.forEach((gltf, n) => gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    if (n === 1) { // Hautschicht: nur ausgewählte Bereiche übernehmen
      const name = o.userData.zname || o.name;
      o.geometry.computeBoundingBox();
      const y = o.geometry.boundingBox.getCenter(V(0, 0, 0)).y;
      const hose = HAUT_HOSE.test(name), kopf = y > 1.475 && !HAUT_AUS.test(name);
      if (/modesty/i.test(name)) return; // der kantige Kasten des Modells wird nicht verwendet
      if (hose && /thigh|femoral/i.test(name)) oberhalb(o.geometry, HOSE_SAUM);
      if (!hose && !kopf && !(HAUT_HAND.test(name) && y > 0.6) && !(HAUT_FUSS.test(name) && y < 0.2)) return;
      o.userData.haut = hose ? "hose" : "haut";
      if (hose) o.userData.hosenGruppe = (HOSE_GRUPPE.find(([, re]) => re.test(name)) || [null])[0];
    }
    quellen.push(o);
  }));
  for (const o of quellen) {
    const name = o.userData.zname || o.name, zgruppe = o.userData.zgroup || "";
    gewichte(o.geometry, name, zgruppe, index);
    const netz = new THREE.SkinnedMesh(o.geometry, material.koerper);
    netz.frustumCulled = false; netz.name = name;
    netz.userData = { haut: o.userData.haut, hosenGruppe: o.userData.hosenGruppe, gruppe: o.userData.haut ? null : gruppeVon(name), sehne: !o.userData.haut && /tendon|aponeurosis|sheath|retinaculum|fascia|ligament/i.test(o.userData.zmat + " " + name) };
    netz.bind(skelett, new THREE.Matrix4());
    wurzel.add(netz); teile.push(netz);
  }

  // Füllstück im Schritt: schließt die Lücke zwischen den Hosenteilen, durch die sonst Muskeln scheinen
  material.hose.roughness = 1;
  const zwickel = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material.hose);
  zwickel.scale.set(0.05, 0.065, 0.04); zwickel.position.set(0, 0.815, 0.022);
  wurzel.add(zwickel);

  function faerbe({ primaer = [], sekundaer = [] } = {}) {
    for (const t of teile) {
      const g = t.userData.gruppe;
      const hg = t.userData.hosenGruppe;
      t.material = hg && enthaelt(primaer, hg) ? material.hosePrimaer : hg && enthaelt(sekundaer, hg) ? material.hoseSekundaer : t.userData.haut ? material[t.userData.haut] : t.userData.sehne ? material.sehne : enthaelt(primaer, g) ? material.primaer : enthaelt(sekundaer, g) ? material.sekundaer : material.koerper;
    }
  }

  // Richtet einen Knochen von seinem Startpunkt auf einen Zielpunkt aus (Koordinaten im Körper-System).
  function ziele(name, endName, start, ende) {
    const b = knochen[name], ruheRichtung = GELENKE[endName].clone().sub(GELENKE[name]).normalize();
    b.position.copy(start);
    b.quaternion.setFromUnitVectors(ruheRichtung, ende.clone().sub(start).normalize());
    return b.quaternion;
  }
  // Zwei-Knochen-Kette: Wurzel fest, Ende auf das Ziel, das Mittelgelenk knickt in Richtung "pol".
  function kette(a, ziel, l1, l2, pol) {
    const delta = ziel.clone().sub(a), d = Math.min(delta.length(), (l1 + l2) * 0.999), achse = delta.normalize();
    const entlang = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hoehe = Math.sqrt(Math.max(0, l1 * l1 - entlang * entlang));
    const quer = pol.clone().addScaledVector(achse, -pol.dot(achse)).normalize();
    return [a.clone().addScaledVector(achse, entlang).addScaledVector(quer, hoehe), a.clone().addScaledVector(achse, d)];
  }
  const laenge = (a, b) => GELENKE[a].distanceTo(GELENKE[b]);

  // pose: { hand: {"-1": Vector3, "1": Vector3}, ellbogenPol, fuss, kniePol } – alles im Körper-System.
  function pose(p) {
    const griffe = {};
    for (const s of [-1, 1]) {
      const schulter = GELENKE["oberarm" + s];
      const [ellbogen, hand] = kette(schulter, p.hand[s], laenge("oberarm" + s, "unterarm" + s), laenge("unterarm" + s, "hand" + s), p.ellbogenPol[s]);
      const qArm = ziele("oberarm" + s, "unterarm" + s, schulter, ellbogen);
      knochen["schulter" + s].quaternion.identity().slerp(qArm, 0.5);
      let q = ziele("unterarm" + s, "hand" + s, ellbogen, hand).clone();
      if (p.handflaeche) { // Unterarm so verdrehen, dass die Handfläche in die gewünschte Richtung zeigt
        const achse = hand.clone().sub(ellbogen).normalize(), quer = v => v.addScaledVector(achse, -v.dot(achse)).normalize();
        const jetzt = quer(V(0, 0, 1).applyQuaternion(q)), soll = quer(p.handflaeche[s].clone());
        const winkel = Math.atan2(achse.dot(jetzt.clone().cross(soll)), jetzt.dot(soll));
        knochen["unterarm" + s].quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(achse, winkel / 2)); // Unterarm dreht halb mit
        q = new THREE.Quaternion().setFromAxisAngle(achse, winkel).multiply(q);
      }
      // Hand läuft starr mit dem Unterarm mit; mit "griff" schließen sich die Finger um einen Griff.
      const beuge = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), p.griff ? -1.25 : 0);
      const qFinger = q.clone().multiply(beuge), qSpitzen = qFinger.clone().multiply(beuge);
      const ortFinger = GELENKE["finger" + s].clone().sub(GELENKE["hand" + s]).applyQuaternion(q).add(hand);
      const ortSpitzen = GELENKE["spitzen" + s].clone().sub(GELENKE["finger" + s]).applyQuaternion(qFinger).add(ortFinger);
      griffe[s] = ortFinger.clone().add(V(0, 0.005, 0.03).applyQuaternion(q)); // Handfläche, knapp vor den Fingergrundgelenken
      knochen["hand" + s].position.copy(hand); knochen["hand" + s].quaternion.copy(q);
      const daumenDreh = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), p.griff ? -s * 1.15 : 0); // Daumen schwenkt vor die Handfläche
      knochen["daumen" + s].position.copy(GELENKE["daumen" + s].clone().sub(GELENKE["hand" + s]).applyQuaternion(q).add(hand));
      knochen["daumen" + s].quaternion.copy(q).multiply(daumenDreh);
      knochen["finger" + s].position.copy(ortFinger); knochen["finger" + s].quaternion.copy(qFinger);
      knochen["spitzen" + s].position.copy(ortSpitzen); knochen["spitzen" + s].quaternion.copy(qSpitzen);
      const huefte = GELENKE["oberschenkel" + s];
      const fussZiel = p.fuss ? p.fuss[s] : GELENKE["fuss" + s], kniePol = p.kniePol ? p.kniePol[s] : V(0, 0, 1);
      const [knie, knoechel] = kette(huefte, fussZiel, laenge("oberschenkel" + s, "unterschenkel" + s), laenge("unterschenkel" + s, "fuss" + s), kniePol);
      const qBein = ziele("oberschenkel" + s, "unterschenkel" + s, huefte, knie);
      knochen["huefte" + s].quaternion.identity().slerp(qBein, 0.5);
      ziele("unterschenkel" + s, "fuss" + s, knie, knoechel);
      knochen["fuss" + s].position.copy(knoechel);
      knochen["fuss" + s].quaternion.copy(p.fussDrehung || new THREE.Quaternion());
    }
    wurzel.updateMatrixWorld(true);
    // Griffpunkt: Mitte der Handfläche, etwas vor den Fingergrundgelenken
    return { griff: s => wurzel.localToWorld(griffe[s].clone()) };
  }
  return { wurzel, faerbe, pose, GELENKE, anzahl: teile.length };
}

export function kurzhantel() {
  const g = new THREE.Group();
  const dunkel = new THREE.MeshStandardMaterial({ color: 0x26272c, roughness: 0.55 }), rand = new THREE.MeshStandardMaterial({ color: 0x3a3b42, roughness: 0.5 });
  const chrom = new THREE.MeshStandardMaterial({ color: 0xd0d2d8, roughness: 0.3, metalness: 0.7 });
  const quer = m => { m.rotation.z = Math.PI / 2; g.add(m); return m; };
  quer(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.15, 20), chrom));
  for (const s of [-1, 1]) {
    quer(new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.05, 6), dunkel)).position.x = s * 0.092;   // Sechskant-Gewicht
    quer(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 20), rand)).position.x = s * 0.062;   // Bund am Griff
    quer(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 20), rand)).position.x = s * 0.1185;    // Stirnseite
  }
  return g;
}

// Weicher Schatten auf dem Boden
export function bodenschatten(radius = 0.9) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d"), v = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  v.addColorStop(0, "rgba(0,0,0,0.55)"); v.addColorStop(0.6, "rgba(0,0,0,0.22)"); v.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = v; x.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.002;
  return m;
}
