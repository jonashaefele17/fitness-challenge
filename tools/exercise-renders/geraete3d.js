// Einfache 3D-Geräte im Stil der gezeichneten Gerätebilder: Kabelturm, Schrägbank, Seil-Aufsatz.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mat = (farbe, rau = 0.6, metall = 0) => new THREE.MeshStandardMaterial({ color: farbe, roughness: rau, metalness: metall });
export const MATERIAL = {
  rahmen: mat(0x3a3b42), verkleidung: mat(0x2c2d33, 0.7), blende: mat(0x383940, 0.7), polster: mat(0x26272c, 0.75),
  chrom: mat(0xd0d2d8, 0.28, 0.75), gummi: mat(0x17181b, 0.85), gelb: mat(0xf2cf1d, 0.5), orange: mat(0xe8742a, 0.6),
  hell: mat(0xd8d8dc, 0.6), kabel: mat(0x8b8d96, 0.5, 0.3), seil: mat(0xc9c2ad, 0.9)
};

export const kasten = (b, h, t, m, rund = 0.012) => new THREE.Mesh(new RoundedBoxGeometry(b, h, t, 4, Math.min(rund, b / 2, h / 2, t / 2)), m);

// Zylinder zwischen zwei Punkten (Rohr, Kabel, Seil)
export function stab(a, b, radius, m, radiusEnde = radius) {
  const laenge = a.distanceTo(b), netz = new THREE.Mesh(new THREE.CylinderGeometry(radiusEnde, radius, laenge, 14), m);
  netz.position.copy(a).lerp(b, 0.5);
  netz.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return netz;
}
function rolle(radius, m = MATERIAL.verkleidung) { // Umlenkrolle, Achse entlang X
  const g = new THREE.Group();
  const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.022, 28), m); scheibe.rotation.z = Math.PI / 2; g.add(scheibe);
  const nabe = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.3, radius * 0.3, 0.03, 16), MATERIAL.hell); nabe.rotation.z = Math.PI / 2; g.add(nabe);
  return g;
}

export const ROLLENHOEHE = { oben: 1.95, mitte: 1.1, unten: 0.22 };

// Kabelturm: Gewichtsblock in der Mitte, zwei Chromstangen, Querträger oben. Benutzt wird die Stange bei x = 0.
// Der Turm steht bei z = abstand vor der Figur. Rückgabe: Gruppe und Austrittspunkt des Kabels an der Rolle.
export function kabelturm3d(hoehe = "oben", abstand = 0.95) {
  const g = new THREE.Group(), M = MATERIAL, H = 2.2, mitteX = -0.45, y = ROLLENHOEHE[hoehe];
  const dazu = (netz, x, yy, z) => { netz.position.set(x, yy, z); g.add(netz); return netz; };
  dazu(kasten(1.12, 0.03, 0.5, M.rahmen), mitteX, 0.015, abstand + 0.08);
  for (const x of [0, -0.9]) {
    dazu(kasten(0.07, H, 0.09, M.rahmen), x, H / 2, abstand + 0.13);                                   // schwarzer Holm
    g.add(stab(V(x, 0.03, abstand), V(x, H - 0.05, abstand), 0.019, M.chrom));                        // Chromstange
    dazu(kasten(0.1, 0.02, 0.14, M.gummi), x, 0.04, abstand + 0.05);
    const r = rolle(0.05); r.position.set(x, H - 0.13, abstand - 0.02); g.add(r);
  }
  dazu(kasten(1.14, 0.1, 0.13, M.rahmen, 0.03), mitteX, H + 0.02, abstand + 0.1);                     // Querträger
  // Gewichtsblock
  dazu(kasten(0.36, 1.72, 0.24, M.verkleidung, 0.03), mitteX, 0.9, abstand + 0.14);
  dazu(kasten(0.17, 1.66, 0.012, M.blende, 0.005), mitteX + 0.085, 0.9, abstand + 0.018);
  dazu(kasten(0.07, 0.05, 0.006, M.orange, 0.002), mitteX + 0.09, 1.52, abstand + 0.01);
  dazu(kasten(0.05, 0.48, 0.008, M.gummi, 0.003), mitteX - 0.06, 0.42, abstand + 0.018);              // Fenster mit Gewichtsplatten
  for (let i = 0; i < 11; i++) dazu(kasten(0.034, 0.012, 0.004, M.hell, 0.001), mitteX - 0.06, 0.21 + i * 0.042, abstand + 0.012);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), M.gelb); pin.position.set(mitteX - 0.06, 0.7, abstand + 0.012); g.add(pin);
  // Gehäuse zwischen Gewichtsblock und Querträger; das Kabel läuft von der Stangenrolle quer hinein
  dazu(kasten(0.2, H - 1.74, 0.12, M.verkleidung, 0.02), mitteX, (H + 1.74) / 2, abstand + 0.1);
  g.add(stab(V(0.0, H - 0.085, abstand - 0.02), V(mitteX + 0.1, H - 0.085, abstand + 0.06), 0.004, M.kabel));
  // Verstellbare Rolle an der benutzten Stange
  dazu(kasten(0.09, 0.14, 0.1, M.verkleidung, 0.02), 0, y, abstand);
  const r = rolle(0.075, M.gummi); r.position.set(0, y, abstand - 0.09); g.add(r);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 10, 28), M.gelb); ring.rotation.y = Math.PI / 2; ring.position.set(0.014, y, abstand - 0.09); g.add(ring);
  const ring2 = ring.clone(); ring2.position.x = -0.014; g.add(ring2);
  g.add(stab(V(0.03, y + 0.07, abstand - 0.03), V(0.03, H - 0.13, abstand - 0.03), 0.004, M.kabel));  // Kabel zur oberen Rolle
  const austritt = V(0, y + (hoehe === "unten" ? 0.06 : -0.06), abstand - 0.15);
  return { gruppe: g, austritt };
}

// Seil-Aufsatz: Kabel vom Turm bis zum Knoten, von dort je ein Seilende in jede Hand
export function seilAufsatz(austritt, handLinks, handRechts) {
  const g = new THREE.Group(), M = MATERIAL;
  const mitte = handLinks.clone().lerp(handRechts, 0.5);
  const knoten = mitte.clone().add(austritt.clone().sub(mitte).normalize().multiplyScalar(0.2));
  g.add(stab(austritt, knoten, 0.004, M.kabel));
  const haken = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), M.chrom); haken.position.copy(knoten); g.add(haken);
  for (const hand of [handLinks, handRechts]) {
    const ende = hand.clone().add(hand.clone().sub(knoten).normalize().multiplyScalar(0.07));
    g.add(stab(knoten, ende, 0.011, M.seil));
    const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), M.gummi); knauf.position.copy(ende); g.add(knauf);
  }
  return g;
}

export function schraegbank(wurzel) {
  const g = new THREE.Group(), M = MATERIAL;
  const lehne = kasten(0.30, 0.98, 0.075, M.polster, 0.03); lehne.position.copy(wurzel.localToWorld(V(0, 1.12, -0.175))); lehne.quaternion.copy(wurzel.quaternion); g.add(lehne);
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); };
  dazu(kasten(0.30, 0.075, 0.38, M.polster, 0.03), 0, 0.39, 0.17);
  dazu(kasten(0.07, 0.07, 1.25, M.rahmen), 0, 0.06, -0.25);
  for (const z of [-0.85, 0.32]) {
    dazu(kasten(0.50, 0.06, 0.07, M.rahmen), 0, 0.03, z);
    for (const x of [-0.25, 0.25]) dazu(kasten(0.05, 0.068, 0.078, M.gummi), x, 0.03, z);
  }
  dazu(kasten(0.07, 0.34, 0.07, M.rahmen), 0, 0.20, 0.15);
  dazu(kasten(0.07, 0.95, 0.07, M.rahmen), 0, 0.50, -0.72);
  return g;
}

// Rohrzug durch mehrere Punkte, mit Kugeln an den Knicken für runde Übergänge
export function rohrzug(punkte, radius, m) {
  const g = new THREE.Group();
  punkte.forEach((p, i) => {
    const kugel = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), m); kugel.position.copy(p); g.add(kugel);
    if (i) g.add(stab(punkte[i - 1], p, radius, m));
  });
  return g;
}

// Gewichtsturm der Technogym-Geräte: Verkleidung mit Etikettenfeld, Logo-Schild, Schlitz mit gelbem Pin, Rohrbügel.
// Im eigenen Koordinatensystem zeigt die Seite mit dem Schlitz nach +z, die Rohrbügel sitzen bei -x.
export function technogymTurm() {
  const turm = new THREE.Group(), M = MATERIAL, R = 0.032;
  const anTurm = (netz, x, y, z) => { netz.position.set(x, y, z); turm.add(netz); return netz; };
  anTurm(kasten(0.36, 1.56, 0.26, M.verkleidung, 0.045), 0, 0.79, 0);
  anTurm(kasten(0.13, 1.0, 0.014, M.blende, 0.006), -0.09, 0.82, 0.132);          // Etikettenfeld
  anTurm(kasten(0.06, 0.07, 0.004, M.hell, 0.002), -0.09, 1.16, 0.141);
  anTurm(kasten(0.06, 0.04, 0.004, M.hell, 0.002), -0.09, 1.07, 0.141);
  anTurm(kasten(0.13, 0.04, 0.006, M.gelb, 0.004), 0.02, 1.46, 0.131);            // Logo-Schild, Seite zum Sitz
  anTurm(kasten(0.045, 0.9, 0.01, M.gummi, 0.02), 0.07, 0.72, 0.129);             // Schlitz für den Gewichtspin
  for (let i = 0; i < 7; i++) anTurm(kasten(0.03, 0.008, 0.004, M.gelb, 0.001), 0.125, 0.32 + i * 0.035, 0.131);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), M.gelb); pin.position.set(0.07, 0.56, 0.135); turm.add(pin);
  anTurm(kasten(0.09, 0.04, 0.07, M.gummi, 0.012), -0.04, 0.2, 0.15);              // Becherhalter
  anTurm(kasten(0.006, 0.04, 0.13, M.gelb, 0.003), -0.181, 1.46, 0);              // Logo-Schild, Vorderseite
  anTurm(kasten(0.012, 1.1, 0.15, M.blende, 0.005), -0.181, 0.78, 0);             // Blende, Vorderseite
  // Rohrbügel an der Vorderseite des Turms
  for (const z of [0.12, -0.14]) turm.add(rohrzug([V(-0.23, 0.035, z), V(-0.23, 1.5, z), V(-0.16, 1.58, z), V(0, 1.58, z)], R, M.rahmen));
  turm.add(rohrzug([V(-0.23, 0.035, -0.14), V(-0.23, 0.035, 0.12)], R, M.rahmen));
  return turm;
}

// Brustpresse (nach Fotos des Technogym-Geräts): Gewichtsturm rechts neben dem Sitz, dreiteilige Rückenlehne,
// Drehachse über dem Kopf, zwei Pressarme. "wurzel" ist die sitzende Figur; die Lehne richtet sich an ihr aus.
export function brustpresse3d(wurzel) {
  const g = new THREE.Group(), M = MATERIAL, R = 0.032;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  const anLehne = (netz, lokal) => { netz.position.copy(wurzel.localToWorld(lokal)); netz.quaternion.copy(wurzel.quaternion); g.add(netz); };
  // Sitz und dreiteilige Rückenlehne
  dazu(kasten(0.36, 0.075, 0.36, M.polster, 0.035), 0, 0.42, 0.13);
  anLehne(kasten(0.34, 0.34, 0.07, M.polster, 0.035), V(0, 1.03, -0.185));
  anLehne(kasten(0.25, 0.19, 0.07, M.polster, 0.03), V(0, 1.31, -0.185));
  anLehne(kasten(0.25, 0.19, 0.07, M.polster, 0.03), V(0, 1.515, -0.185));
  anLehne(kasten(0.02, 0.05, 0.012, M.gelb, 0.004), V(0.13, 1.36, -0.15));
  // Sitzsäule mit Skala und gelbem Verstellknopf
  dazu(kasten(0.09, 0.36, 0.09, M.rahmen, 0.02), 0, 0.21, 0.13);
  dazu(kasten(0.012, 0.16, 0.004, M.hell, 0.002), 0.03, 0.24, 0.177);
  const knopf = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), M.gelb); knopf.rotation.x = Math.PI / 2; knopf.position.set(-0.1, 0.36, 0.3); g.add(knopf);
  // Bodenrahmen und hintere Säule
  const saeuleOben = V(0, 1.62, -0.42), achseL = V(-0.4, 1.5, -0.3), achseR = V(0.4, 1.5, -0.3);
  g.add(rohrzug([V(-0.24, 0.035, 0.38), V(0.24, 0.035, 0.38)], R, M.rahmen));
  g.add(rohrzug([V(0, 0.035, 0.38), V(0, 0.035, -0.42), saeuleOben], R, M.rahmen));
  g.add(rohrzug([V(0, 0.035, -0.1), V(-0.8, 0.035, -0.1)], R, M.rahmen));
  // Drehachse über dem Kopf, an der hinteren Säule aufgehängt und mit dem Turm verbunden
  g.add(rohrzug([saeuleOben, V(0, 1.5, -0.3)], R, M.rahmen));
  g.add(rohrzug([achseL, achseR], 0.05, M.rahmen));
  for (const p of [achseL, achseR]) { const kappe = new THREE.Mesh(new THREE.SphereGeometry(0.056, 18, 12), M.verkleidung); kappe.position.copy(p); g.add(kappe); }
  dazu(kasten(0.03, 0.02, 0.004, M.gelb, 0.002), 0.1, 1.5, -0.249);
  g.add(rohrzug([achseL, V(-0.62, 1.56, -0.22), V(-0.8, 1.56, -0.1)], R, M.rahmen));
  // Gewichtsturm, um 90° gedreht – der Schlitz mit dem Gewichtspin zeigt zum Sitz, die Rohrbügel nach vorn
  const turm = technogymTurm(); turm.position.set(-0.84, 0, -0.08); turm.rotation.y = Math.PI / 2; g.add(turm);
  return { gruppe: g, achse: { "-1": achseL, "1": achseR } };
}

// Pressarme der Brustpresse: von der Drehachse außen am Körper vorbei zum Griff in der Hand
export function pressarme(achse, griffe) {
  const g = new THREE.Group(), M = MATERIAL;
  for (const s of [-1, 1]) {
    const hand = griffe[s], aussen = V(s * 0.43, hand.y, hand.z);
    g.add(rohrzug([achse[s], V(s * 0.43, achse[s].y - 0.06, achse[s].z + 0.1), V(s * 0.43, hand.y + 0.12, hand.z - 0.02), aussen], 0.028, M.rahmen));
    g.add(rohrzug([aussen, V(s * 0.33, hand.y, hand.z)], 0.022, M.rahmen));
    g.add(stab(V(s * 0.33, hand.y, hand.z), V(hand.x - s * 0.07, hand.y, hand.z), 0.024, M.gummi)); // Griff
  }
  return g;
}

// Turm, den Latzug und Ruderzug teilen: zwei Holme hintereinander, dazwischen der Gewichtsblock, Blenden seitlich
function turmLaengs(g, zVorn, H) {
  const M = MATERIAL, zHinten = zVorn + 0.56, zMitte = zVorn + 0.28;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  // Rahmen: zwei Holme hintereinander, Bodenplatte, hintere Stütze
  for (const z of [zVorn, zHinten]) dazu(kasten(0.08, H, 0.06, M.rahmen), 0, H / 2, z);
  dazu(kasten(0.5, 0.03, 0.74, M.rahmen), 0, 0.015, zMitte);
  g.add(stab(V(0, 0.5, zHinten + 0.02), V(0, 0.03, zHinten + 0.24), 0.025, M.rahmen));
  dazu(kasten(0.3, 0.03, 0.06, M.rahmen), 0, 0.015, zHinten + 0.24);
  // Gewichtsblock zwischen den Holmen: Führungsstangen, Platten, gelber Pin
  for (const z of [zMitte - 0.05, zMitte + 0.05]) g.add(stab(V(0, 0.05, z), V(0, H - 0.1, z), 0.01, M.chrom));
  for (let i = 0; i < 14; i++) {
    dazu(kasten(0.16, 0.03, 0.26, i % 2 ? M.gummi : M.verkleidung, 0.004), 0, 0.09 + i * 0.034, zMitte);
    for (const x of [-0.082, 0.082]) dazu(kasten(0.004, 0.006, 0.03, M.hell, 0.001), x, 0.09 + i * 0.034, zMitte);
  }
  for (const x of [-0.084, 0.084]) { const pin = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), M.gelb); pin.position.set(x, 0.43, zMitte); g.add(pin); }
  // Seitliche Blenden: je zwei hohe Platten mit Spalt, durch den man Block und Seil sieht
  for (const x of [-0.11, 0.11]) for (const z of [zMitte - 0.125, zMitte + 0.125]) dazu(kasten(0.04, 1.62, 0.19, M.verkleidung, 0.018), x, 1.12, z);
}

// Latzug (nach Foto): Der Rahmen steht längs zur Blickrichtung – ein Holm vorn am Sitz, einer hinten, dazwischen der
// Gewichtsblock. Die dunklen Blenden sitzen seitlich, der Ausleger läuft oben nach vorn bis über den Sitz.
// Die Figur sitzt bei z = 0 und schaut zum Turm (z = abstand).
export function latzug3d(abstand = 0.6) {
  const g = new THREE.Group(), M = MATERIAL, H = 2.25;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  const zVorn = abstand, zHinten = abstand + 0.56, zMitte = abstand + 0.28, vorn = -0.02;
  turmLaengs(g, zVorn, H);
  // Ausleger nach vorn mit Umlenkrollen und Strebe
  dazu(kasten(0.08, 0.08, zHinten + 0.05 - vorn + 0.1, M.rahmen, 0.02), 0, H + 0.02, (zHinten + 0.05 + vorn - 0.1) / 2);
  g.add(stab(V(0, H - 0.02, zVorn - 0.3), V(0, H - 0.36, zVorn), 0.022, M.rahmen));
  for (const z of [vorn, zMitte]) {
    const r = new THREE.Group();
    const sch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.022, 28), M.verkleidung); sch.rotation.z = Math.PI / 2; r.add(sch);
    const nabe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 16), M.hell); nabe.rotation.z = Math.PI / 2; r.add(nabe);
    r.position.set(0, H - 0.07, z); g.add(r);
  }
  g.add(stab(V(0, H - 0.012, vorn), V(0, H - 0.012, zMitte), 0.004, M.kabel));
  g.add(stab(V(0, H - 0.07, zMitte + 0.06), V(0, 0.58, zMitte + 0.06), 0.004, M.kabel));
  // Sitz mit Gestell und Oberschenkelpolstern
  dazu(kasten(0.34, 0.07, 0.36, M.polster, 0.035), 0, 0.5, -0.04);
  dazu(kasten(0.07, 0.07, zVorn + 0.4, M.rahmen), 0, 0.3, (zVorn - 0.4) / 2);
  dazu(kasten(0.07, 0.17, 0.07, M.rahmen), 0, 0.4, -0.04);
  g.add(stab(V(0, 0.3, -0.36), V(0, 0.03, -0.42), 0.03, M.rahmen));
  dazu(kasten(0.4, 0.05, 0.07, M.rahmen), 0, 0.025, -0.42);
  dazu(kasten(0.06, 0.4, 0.06, M.rahmen), 0, 0.5, 0.33);
  for (const x of [-0.15, 0.15]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 22), M.polster); p.rotation.z = Math.PI / 2; p.position.set(x, 0.72, 0.31); g.add(p); }
  g.add(stab(V(-0.25, 0.72, 0.31), V(0.25, 0.72, 0.31), 0.016, M.rahmen));
  return { gruppe: g, austritt: V(0, H - 0.13, vorn - 0.045) };
}

// Latzugstange: gerade Mitte, abgewinkelte Enden mit Griffen; hängt am Kabel
export function latstange(austritt, griffLinks, griffRechts) {
  const g = new THREE.Group(), M = MATERIAL, knick = 0.06;
  const mitteX = (griffLinks.x + griffRechts.x) / 2, z = (griffLinks.z + griffRechts.z) / 2;
  const handAb = Math.abs(griffRechts.x - griffLinks.x) / 2;            // Abstand der Hand von der Mitte
  const innen = handAb - 0.09, aussen = handAb + 0.11;                  // abgewinkeltes Ende, die Hand greift darin
  const y = (griffLinks.y + griffRechts.y) / 2 + knick * 0.45;          // so hoch, dass das Ende genau durch die Hand läuft
  for (const s of [-1, 1]) {
    const a = V(mitteX + s * innen, y, z), b = V(mitteX + s * aussen, y - knick, z);
    g.add(rohrzug([V(mitteX, y, z), a, b], 0.014, M.chrom));
    g.add(stab(a.clone().lerp(b, 0.12), b, 0.019, M.gummi));
  }
  g.add(stab(V(mitteX, y + 0.01, z), V(mitteX, y + 0.09, z), 0.01, M.chrom));
  g.add(stab(V(mitteX, y + 0.09, z), austritt, 0.004, M.kabel));
  return g;
}

// Enger Parallelgriff: zwei Griffe nebeneinander, die Handflächen zeigen zueinander; ein Bügel führt zum Kabel
export function parallelgriff(austritt, griffLinks, griffRechts) {
  const g = new THREE.Group(), M = MATERIAL;
  const mitte = griffLinks.clone().lerp(griffRechts, 0.5);
  const zug = austritt.clone().sub(mitte).normalize();               // Richtung zum Kabel
  const achse = zug.clone().cross(V(1, 0, 0)).normalize();            // Richtung der beiden Griffe
  mitte.addScaledVector(zug, -0.035);                                 // Griffe sitzen in der Faust, nicht davor
  const spitze = mitte.clone().addScaledVector(zug, 0.15);
  for (const hand of [griffLinks, griffRechts]) {
    const m = V(hand.x, mitte.y, mitte.z), vorn = m.clone().addScaledVector(achse, 0.065), hinten = m.clone().addScaledVector(achse, -0.065);
    g.add(stab(hinten, vorn, 0.018, M.gummi));
    g.add(rohrzug([vorn, vorn.clone().addScaledVector(zug, 0.03).addScaledVector(achse, 0.01), spitze, hinten.clone().addScaledVector(zug, 0.03).addScaledVector(achse, -0.01), hinten], 0.008, M.chrom));
  }
  const oese = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), M.chrom); oese.position.copy(spitze); g.add(oese);
  g.add(stab(spitze, austritt, 0.004, M.kabel));
  return g;
}

// Ruderzug (nach Foto): gleicher Turm, Kabel läuft am vorderen Holm zu einer tiefen Rolle; davor Fußstützen und eine flache Bank.
// Die Figur sitzt bei z = 0 und schaut zum Turm.
export function ruderzug3d(abstand = 1.12) {
  const g = new THREE.Group(), M = MATERIAL, H = 2.1, zMitte = abstand + 0.28;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  turmLaengs(g, abstand, H);
  dazu(kasten(0.08, 0.08, 0.66, M.rahmen, 0.02), 0, H + 0.02, zMitte);
  const rolle = (y, z) => {
    const r = new THREE.Group();
    const sch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.022, 28), M.verkleidung); sch.rotation.z = Math.PI / 2; r.add(sch);
    const nabe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 16), M.hell); nabe.rotation.z = Math.PI / 2; r.add(nabe);
    r.position.set(0, y, z); g.add(r);
  };
  const tiefY = 0.55, tiefZ = abstand - 0.19; // tiefe Rolle vor dem Holm; das Kabel kommt von oben auf der Turmseite an
  rolle(H - 0.07, zMitte); rolle(H - 0.07, abstand - 0.07); rolle(tiefY, tiefZ);
  g.add(stab(V(0, H - 0.012, abstand - 0.07), V(0, H - 0.012, zMitte), 0.004, M.kabel));
  g.add(stab(V(0, H - 0.07, zMitte + 0.06), V(0, 0.58, zMitte + 0.06), 0.004, M.kabel));
  g.add(stab(V(0, H - 0.07, abstand - 0.13), V(0, tiefY, tiefZ + 0.06), 0.004, M.kabel));
  for (const x of [-0.03, 0.03]) dazu(kasten(0.012, 0.07, 0.2, M.rahmen, 0.005), x, tiefY, abstand - 0.11); // Halter der tiefen Rolle
  // Fußstützen: zwei schräge Platten an einem Träger
  dazu(kasten(0.07, 0.07, 0.5, M.rahmen), 0, 0.2, abstand - 0.25);
  // Lage und Neigung so gewählt, dass die Fußsohlen der sitzenden Figur knapp vor der Platte aufliegen
  for (const x of [-0.14, 0.14]) { const p = kasten(0.16, 0.32, 0.025, M.verkleidung, 0.01); p.position.set(x, 0.33, abstand - 0.313); p.rotation.x = 0.524; g.add(p); }
  g.add(stab(V(-0.2, 0.3, abstand - 0.29), V(0.2, 0.3, abstand - 0.29), 0.02, M.rahmen));
  g.add(stab(V(0, 0.2, abstand - 0.29), V(0, 0.3, abstand - 0.29), 0.03, M.rahmen));
  // Flache Bank
  dazu(kasten(0.3, 0.08, 0.5, M.polster, 0.035), 0, 0.38, -0.09);
  dazu(kasten(0.07, 0.07, abstand + 0.34, M.rahmen), 0, 0.2, (abstand - 0.34) / 2);
  for (const z of [-0.24, 0.06]) dazu(kasten(0.06, 0.16, 0.06, M.rahmen), 0, 0.28, z);
  g.add(stab(V(0, 0.2, -0.32), V(0, 0.03, -0.38), 0.03, M.rahmen));
  dazu(kasten(0.42, 0.05, 0.07, M.rahmen), 0, 0.025, -0.38);
  return { gruppe: g, austritt: V(0, tiefY - 0.06, tiefZ) }; // das Kabel verlässt die Rolle unten
}

// Seithebe-Maschine (Technogym Delts, nach Foto und Herstellerbild): Sitz mit hoher Rückenlehne, Gewichtsturm schräg dahinter,
// zwei Hebelarme, die sich auf Schulterhöhe um eine Achse von vorn nach hinten drehen.
export function seitheben3d(wurzel) {
  const g = new THREE.Group(), M = MATERIAL, R = 0.03;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  const anLehne = (netz, lokal) => { netz.position.copy(wurzel.localToWorld(lokal)); netz.quaternion.copy(wurzel.quaternion); g.add(netz); };
  dazu(kasten(0.34, 0.075, 0.34, M.polster, 0.035), 0, 0.42, 0.1);
  anLehne(kasten(0.3, 0.66, 0.07, M.polster, 0.035), V(0, 1.2, -0.185));
  anLehne(kasten(0.02, 0.05, 0.012, M.gelb, 0.004), V(0.155, 1.2, -0.16));
  dazu(kasten(0.09, 0.36, 0.09, M.rahmen, 0.02), 0, 0.21, 0.1);
  const knopf = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), M.gelb); knopf.rotation.x = Math.PI / 2; knopf.position.set(-0.1, 0.36, 0.26); g.add(knopf);
  // Bodenrahmen und hintere Säule, an der Lehne und Hebel hängen
  g.add(rohrzug([V(-0.24, 0.035, 0.34), V(0.24, 0.035, 0.34)], R, M.rahmen));
  g.add(rohrzug([V(0, 0.035, 0.34), V(0, 0.035, -0.36), V(0, 1.5, -0.36)], R, M.rahmen));
  g.add(rohrzug([V(0, 0.035, -0.2), V(-0.62, 0.035, -0.45)], R, M.rahmen));
  const turm = technogymTurm(); turm.position.set(-0.62, 0, -0.52); turm.rotation.y = Math.PI / 2; g.add(turm);
  return { gruppe: g };
}

// Hebelarme der Seithebe-Maschine für eine gegebene Armhaltung: Drehpunkt hinter der Schulter, Polster außen am Oberarm,
// gelber Griff in der Hand. schulter/ellbogen/hand sind Weltpunkte je Seite.
export function seithebel(punkte) {
  const g = new THREE.Group(), M = MATERIAL;
  for (const s of [-1, 1]) {
    const { schulter, ellbogen } = punkte[s], hand = punkte[s].griff || punkte[s].hand; // Griff liegt in der Handfläche, nicht am Handgelenk
    const arm = ellbogen.clone().sub(schulter).normalize();                 // Richtung des Oberarms
    const aussen = V(-arm.y, arm.x, 0).multiplyScalar(arm.x * s >= 0 ? 1 : -1); // quer zum Oberarm, vom Körper weg
    if (aussen.x * s < 0) aussen.multiplyScalar(-1);
    const dreh = schulter.clone().add(V(0, 0, -0.2));
    const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 26), M.verkleidung); scheibe.rotation.x = Math.PI / 2; scheibe.position.copy(dreh); g.add(scheibe);
    g.add(stab(V(0, dreh.y, -0.36), dreh, 0.028, M.rahmen));
    const hinten = ellbogen.clone().addScaledVector(aussen, 0.1).add(V(0, 0, -0.16));
    const vorn = ellbogen.clone().addScaledVector(aussen, 0.1).add(V(0, 0, 0.2));
    g.add(rohrzug([dreh, dreh.clone().addScaledVector(arm, 0.1), hinten, vorn], 0.026, M.rahmen));
    // Polster außen am Oberarm, dem Arm zugewandt
    const polster = kasten(0.045, 0.11, 0.24, M.polster, 0.02);
    polster.position.copy(ellbogen).addScaledVector(aussen, 0.065).add(V(0, 0, 0.02));
    polster.rotation.z = Math.atan2(aussen.y, aussen.x);
    g.add(polster);
    // Gelber Griff: steht in Richtung des Oberarms, über ein Rohr mit dem Hebel verbunden
    const g1 = hand.clone().addScaledVector(arm, -0.06), g2 = hand.clone().addScaledVector(arm, 0.06);
    g.add(stab(g1, g2, 0.019, M.gelb));
    g.add(rohrzug([vorn, g2.clone().addScaledVector(aussen, 0.02), g2], 0.014, M.rahmen));
  }
  return g;
}

// Rudermaschine (Technogym Low Row, nach Foto und Herstellerbild): niedriger Sitz, davor ein wuchtiger Bügel in Längsrichtung,
// auf dem das Brustpolster und die Drehachse der beiden Hebelarme sitzen; der Gewichtsturm steht seitlich daneben.
// Die Figur sitzt bei z = 0 und schaut nach +z.
export function lowrow3d() {
  const g = new THREE.Group(), M = MATERIAL, R = 0.032;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  // Breites Flachrohr zwischen zwei Punkten (für die wuchtigen Rahmenteile)
  const flach = (p, q, breite = 0.13, dicke = 0.07) => {
    const laenge = p.distanceTo(q), netz = kasten(breite, laenge + dicke, dicke, M.rahmen, 0.03);
    netz.position.copy(p).lerp(q, 0.5); netz.quaternion.setFromUnitVectors(V(0, 1, 0), q.clone().sub(p).normalize()); g.add(netz);
  };
  // Sitz auf einem C-förmigen Träger
  dazu(kasten(0.36, 0.075, 0.36, M.polster, 0.035), 0, 0.42, -0.03);
  flach(V(0, 0.36, -0.16), V(0, 0.36, 0.12));
  flach(V(0, 0.36, -0.16), V(0, 0.06, -0.24));
  const knopf = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), M.gelb); knopf.rotation.z = Math.PI / 2; knopf.position.set(0.2, 0.37, -0.03); g.add(knopf);
  // Wuchtiger Bügel vor dem Sitz: hinteres Bein, Oberholm, vorderes Bein
  const bH = V(0, 0.06, 0.2), oH = V(0, 0.6, 0.24), oV = V(0, 0.6, 0.82), bV = V(0, 0.06, 0.9);
  flach(bH, oH); flach(oH, oV); flach(oV, bV);
  // Bodenholm mit Rollen an beiden Enden und Querfuß hinten
  flach(V(0, 0.05, -0.3), V(0, 0.05, 1.0), 0.11, 0.06);
  g.add(rohrzug([V(-0.24, 0.035, -0.3), V(0.24, 0.035, -0.3)], R, M.rahmen));
  for (const z of [-0.2, 0.98]) for (const x of [-0.085, 0.085]) {
    const rolle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24), M.gummi); rolle.rotation.z = Math.PI / 2; rolle.position.set(x, 0.09, z); g.add(rolle);
    const nabe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.034, 14), M.hell); nabe.rotation.z = Math.PI / 2; nabe.position.set(x, 0.09, z); g.add(nabe);
  }
  // Fußstange
  g.add(rohrzug([V(-0.21, 0.17, 0.5), V(0.21, 0.17, 0.5)], 0.026, M.gummi));
  g.add(rohrzug([V(0, 0.06, 0.5), V(0, 0.17, 0.5)], 0.026, M.rahmen));
  // Brustpolster auf einer Stütze, die vom Oberholm aufsteigt
  g.add(rohrzug([V(0, 0.6, 0.3), V(0, 0.98, 0.27)], 0.036, M.rahmen));
  dazu(kasten(0.2, 0.24, 0.07, M.polster, 0.03), 0, 1.0, 0.235);
  // Drehachse der Hebel quer über dem Oberholm
  const achse = { "-1": V(-0.2, 0.66, 0.52), "1": V(0.2, 0.66, 0.52) };
  g.add(rohrzug([achse[-1], achse[1]], 0.04, M.rahmen));
  for (const s of [-1, 1]) { const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 26), M.verkleidung); scheibe.rotation.z = Math.PI / 2; scheibe.position.copy(achse[s]); g.add(scheibe); }
  // Gewichtsturm steht seitlich neben dem Gerät (links vom Sitzenden), der Schlitz zeigt zum Gerät hin
  const turm = technogymTurm(); turm.position.set(0.56, 0, 0.62); turm.rotation.y = -Math.PI / 2; g.add(turm);
  flach(V(0, 0.05, 0.9), V(0.4, 0.05, 0.78), 0.11, 0.06);
  flach(V(0, 0.05, 0.3), V(0.4, 0.05, 0.46), 0.11, 0.06);
  return { gruppe: g, achse };
}

// Hebelarme der Rudermaschine: kräftiges Rohr von der Drehachse zum schräg stehenden Griff in der Hand
export function ruderhebel(achse, griffe) {
  const g = new THREE.Group(), M = MATERIAL;
  for (const s of [-1, 1]) {
    const hand = griffe[s];
    const neigung = V(0, 0.95, 0.3).normalize();                                  // Griff steht leicht nach vorn geneigt
    const unten = hand.clone().addScaledVector(neigung, -0.1), oben = hand.clone().addScaledVector(neigung, 0.09);
    g.add(rohrzug([achse[s], achse[s].clone().add(V(s * 0.06, 0.05, 0)), V(hand.x + s * 0.03, hand.y - 0.2, hand.z + 0.04), unten], 0.036, M.rahmen));
    g.add(stab(unten, oben, 0.023, M.gummi));
    const kappe = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), M.chrom); kappe.position.copy(oben); g.add(kappe);
  }
  return g;
}

// Butterfly-Maschine (Technogym Dual Pectoral / Reverse Fly, nach Foto und Herstellerbild): Sitz mit zweiteiligem Polster,
// dahinter eine hohe Säule mit Ausleger über dem Kopf; daran hängen zwei Schwenkarme, die sich um senkrechte Achsen drehen.
// Der Gewichtsturm steht hinter der Säule. Das Polster ist beim Butterfly die Rückenlehne, beim Reverse Butterfly die Bruststütze.
export const BUTTERFLY = { achseX: 0.2, achseZ: -0.05, hoehe: 1.95, radius: 0.5 };
export function butterfly3d() {
  const g = new THREE.Group(), M = MATERIAL, R = 0.034, B = BUTTERFLY;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  dazu(kasten(0.34, 0.075, 0.34, M.polster, 0.035), 0, 0.42, 0.08);
  dazu(kasten(0.09, 0.36, 0.09, M.rahmen, 0.02), 0, 0.21, 0.08);
  const knopf = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), M.gelb); knopf.rotation.x = Math.PI / 2; knopf.position.set(-0.1, 0.36, 0.24); g.add(knopf);
  for (const [y, z] of [[0.99, -0.2], [1.24, -0.215]]) { const p = kasten(0.27, 0.23, 0.075, M.polster, 0.035); p.position.set(0, y, z); p.rotation.x = -0.05; g.add(p); }
  // Säule mit Ausleger und den beiden Gelenken über den Schultern
  g.add(rohrzug([V(-0.22, 0.035, 0.3), V(0.22, 0.035, 0.3)], R, M.rahmen));
  g.add(rohrzug([V(0, 0.035, 0.3), V(0, 0.035, -0.36), V(0, B.hoehe, -0.36), V(0, B.hoehe, B.achseZ)], 0.04, M.rahmen));
  g.add(rohrzug([V(-B.achseX, B.hoehe, B.achseZ), V(B.achseX, B.hoehe, B.achseZ)], 0.04, M.rahmen));
  for (const s of [-1, 1]) {
    const gelenk = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 26), M.verkleidung); gelenk.position.set(s * B.achseX, B.hoehe, B.achseZ); g.add(gelenk);
    const zapfen = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 16), M.rahmen); zapfen.position.set(s * B.achseX, B.hoehe + 0.1, B.achseZ); g.add(zapfen);
  }
  // Gewichtsturm hinter der Säule
  const turm = technogymTurm(); turm.position.set(0, 0, -0.72); turm.rotation.y = -Math.PI / 2; g.add(turm);
  return { gruppe: g };
}

// Schwenkarme: vom Gelenk oben waagerecht nach außen und dann senkrecht herunter; der Griff liegt in der Hand.
// griffe: Weltpunkte der beiden Hände, Schlüssel -1 / 1 nach Weltseite (x < 0 / x > 0).
export function schwenkarme(griffe) {
  const g = new THREE.Group(), M = MATERIAL, B = BUTTERFLY;
  for (const s of [-1, 1]) {
    const hand = griffe[s], gelenk = V(s * B.achseX, B.hoehe, B.achseZ), oben = V(hand.x, B.hoehe, hand.z);
    g.add(rohrzug([gelenk, oben, V(hand.x, hand.y + 0.1, hand.z)], 0.028, M.rahmen));
    g.add(stab(V(hand.x, hand.y + 0.1, hand.z), V(hand.x, hand.y - 0.1, hand.z), 0.022, M.gummi));
    g.add(rohrzug([V(hand.x, hand.y - 0.1, hand.z), V(hand.x, hand.y - 0.22, hand.z)], 0.028, M.rahmen));
  }
  return g;
}

// Beinpresse (Technogym Selection 700 Leg Press, nach Foto und Herstellerbild): große, feste Fußplatte vorn, Sitz mit
// zurückgelehnter dreiteiliger Lehne auf einem Schlitten, der auf zwei Chromschienen nach hinten fährt; Gewichtsturm seitlich.
// Die Figur schaut nach +z zur Fußplatte.
export const BEINPRESSE = { platte: new THREE.Vector3(0, 0.66, 0.74), neigung: 0.35, schieneY: 0.27 };
export function beinpresse3d() {
  const g = new THREE.Group(), M = MATERIAL, R = 0.034, B = BEINPRESSE;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  // Fußplatte mit Rippen und Griffbügel oben
  const platte = new THREE.Group(); platte.position.copy(B.platte); platte.rotation.x = B.neigung; g.add(platte);
  platte.add(kasten(0.5, 0.66, 0.05, M.verkleidung, 0.03));
  for (let i = 0; i < 9; i++) { const rippe = kasten(0.4, 0.012, 0.01, M.blende, 0.004); rippe.position.set(0, -0.26 + i * 0.065, -0.028); platte.add(rippe); }
  platte.add(rohrzug([V(-0.1, 0.33, 0.01), V(-0.1, 0.42, 0.01), V(0.1, 0.42, 0.01), V(0.1, 0.33, 0.01)], 0.02, M.rahmen));
  g.add(rohrzug([V(-0.2, 0.035, 0.86), V(-0.2, 0.42, 0.84)], R, M.rahmen));
  g.add(rohrzug([V(0.2, 0.035, 0.86), V(0.2, 0.42, 0.84)], R, M.rahmen));
  // Schienen und Bodenrahmen bis zum hinteren Abschluss
  const hinten = -1.08;
  for (const x of [-0.11, 0.11]) g.add(stab(V(x, B.schieneY, 0.55), V(x, B.schieneY, hinten), 0.02, M.chrom));
  for (const x of [-0.3, 0.3]) g.add(rohrzug([V(x, 0.035, 0.86), V(x, 0.035, hinten), V(x, B.schieneY + 0.04, hinten)], R, M.rahmen));
  g.add(rohrzug([V(-0.3, B.schieneY + 0.04, hinten), V(0.3, B.schieneY + 0.04, hinten)], R, M.rahmen));
  g.add(rohrzug([V(-0.3, 0.035, 0.86), V(0.3, 0.035, 0.86)], R, M.rahmen));
  dazu(kasten(0.3, 0.1, 0.1, M.rahmen, 0.02), 0, B.schieneY - 0.03, 0.56);
  // Gewichtsturm seitlich, Schlitz zum Gerät hin; ein Arm hält die Fußplatte
  const turm = technogymTurm(); turm.position.set(-0.62, 0, 0.12); turm.rotation.y = Math.PI / 2; g.add(turm);
  g.add(rohrzug([V(-0.46, 0.78, 0.3), V(-0.3, 0.74, 0.62), V(-0.2, 0.7, 0.76)], 0.04, M.rahmen));
  g.add(rohrzug([V(-0.3, 0.035, 0.12), V(-0.48, 0.035, 0.12)], R, M.rahmen));
  return { gruppe: g };
}

// Schlitten der Beinpresse für die aktuelle Sitzposition: Sitz, dreiteilige Lehne (an der Figur ausgerichtet), Unterbau, Griffe
export function beinpresseSchlitten(wurzel, griffe) {
  const g = new THREE.Group(), M = MATERIAL, B = BEINPRESSE;
  const huefte = wurzel.localToWorld(V(0, 0.85, -0.03));
  const anLehne = (netz, lokal) => { netz.position.copy(wurzel.localToWorld(lokal)); netz.quaternion.copy(wurzel.quaternion); g.add(netz); };
  const sitz = kasten(0.38, 0.08, 0.36, M.polster, 0.035); sitz.position.set(0, huefte.y - 0.115, huefte.z + 0.1); sitz.rotation.x = -0.12; g.add(sitz);
  anLehne(kasten(0.36, 0.36, 0.08, M.polster, 0.04), V(0, 1.04, -0.19));
  anLehne(kasten(0.26, 0.2, 0.08, M.polster, 0.035), V(0, 1.335, -0.19));
  anLehne(kasten(0.26, 0.2, 0.08, M.polster, 0.035), V(0, 1.55, -0.19));
  // Träger hinter der Lehne und Unterbau auf den Schienen
  g.add(rohrzug([wurzel.localToWorld(V(0, 0.82, -0.26)), wurzel.localToWorld(V(0, 1.6, -0.26))], 0.035, M.rahmen));
  const block = kasten(0.34, 0.16, 0.46, M.rahmen, 0.03); block.position.set(0, B.schieneY + 0.06, huefte.z - 0.02); g.add(block);
  const knopf = kasten(0.03, 0.03, 0.12, M.gelb, 0.012); knopf.position.set(0.19, B.schieneY + 0.1, huefte.z + 0.16); g.add(knopf);
  // Haltegriffe neben dem Sitz
  for (const s of [-1, 1]) {
    const hand = griffe[s];
    g.add(rohrzug([V(s * 0.17, B.schieneY + 0.1, huefte.z - 0.05), V(hand.x, hand.y - 0.02, hand.z - 0.1)], 0.022, M.rahmen));
    g.add(stab(V(hand.x, hand.y - 0.02, hand.z - 0.1), V(hand.x, hand.y + 0.01, hand.z + 0.07), 0.021, M.gummi));
  }
  return g;
}

// Beinbeuger sitzend (Technogym Selection 700 Leg Curl, nach Foto): Sitz mit zweiteiliger Lehne, festes Rollenpolster über den
// Oberschenkeln, bewegliches Rollenpolster hinter den Unterschenkeln an einem Hebel, der auf Kniehöhe dreht; Turm seitlich.
// Die Figur schaut nach +z. knie = Drehpunkt (Welt), rolle = Mitte des beweglichen Polsters (Welt).
export const BEINBEUGER = { knieY: 0.63, knieZ: 0.4 };
export function beinbeuger3d(wurzel, oberschenkelPolster = true) {
  const g = new THREE.Group(), M = MATERIAL, R = 0.034, B = BEINBEUGER;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  const anLehne = (netz, lokal) => { netz.position.copy(wurzel.localToWorld(lokal)); netz.quaternion.copy(wurzel.quaternion); g.add(netz); };
  // Sitz, Lehne, Haltegriffe
  dazu(kasten(0.42, 0.09, 0.46, M.polster, 0.04), 0, 0.5, 0.13);
  anLehne(kasten(0.36, 0.4, 0.08, M.polster, 0.04), V(0, 1.06, -0.19));
  anLehne(kasten(0.28, 0.22, 0.08, M.polster, 0.035), V(0, 1.4, -0.19));
  g.add(rohrzug([wurzel.localToWorld(V(0, 0.8, -0.26)), wurzel.localToWorld(V(0, 1.45, -0.26))], 0.035, M.rahmen));
  // Gestell
  for (const [x, z] of [[-0.2, -0.12], [0.2, -0.12], [-0.2, 0.12], [0.2, 0.12]]) dazu(kasten(0.07, 0.44, 0.07, M.rahmen, 0.02), x, 0.24, z);
  g.add(rohrzug([V(-0.2, 0.035, -0.12), V(0.2, 0.035, -0.12)], R, M.rahmen));
  g.add(rohrzug([V(-0.2, 0.035, 0.12), V(0.2, 0.035, 0.12)], R, M.rahmen));
  g.add(rohrzug([V(0.2, 0.035, -0.12), V(0.2, 0.035, 0.12)], R, M.rahmen));
  g.add(rohrzug([V(-0.2, 0.035, -0.12), V(-0.2, 0.035, 0.12)], R, M.rahmen));
  // Festes Rollenpolster über den Oberschenkeln, von der Turmseite gehalten
  if (oberschenkelPolster) {
    const oben = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.46, 26), M.polster); oben.rotation.z = Math.PI / 2; oben.position.set(0, B.knieY + 0.155, B.knieZ - 0.12); g.add(oben);
    g.add(rohrzug([V(-0.42, 0.9, 0.0), V(-0.3, B.knieY + 0.155, B.knieZ - 0.12), V(-0.23, B.knieY + 0.155, B.knieZ - 0.12)], 0.03, M.rahmen));
  } else { // Beinstrecker: Haltegriffe neben dem Sitz
    for (const x of [-0.27, 0.27]) g.add(rohrzug([V(x * 0.8, 0.48, -0.02), V(x, 0.56, 0.02), V(x, 0.6, 0.2)], 0.022, M.rahmen));
    for (const x of [-0.27, 0.27]) g.add(stab(V(x, 0.585, 0.12), V(x, 0.6, 0.2), 0.024, M.gummi));
  }
  // Drehscheibe am Knie mit Verstellhebel (gelbe Spitze)
  const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 34), M.verkleidung); scheibe.rotation.z = Math.PI / 2; scheibe.position.set(-0.3, B.knieY, B.knieZ); g.add(scheibe);
  const nabe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 20), M.rahmen); nabe.rotation.z = Math.PI / 2; nabe.position.set(-0.3, B.knieY, B.knieZ); g.add(nabe);
  g.add(stab(V(-0.32, B.knieY, B.knieZ), V(-0.32, B.knieY + 0.3, B.knieZ + 0.12), 0.012, M.rahmen));
  const spitze = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), M.gelb); spitze.position.set(-0.32, B.knieY + 0.3, B.knieZ + 0.12); g.add(spitze);
  // Gewichtsturm seitlich, Schlitz zum Gerät hin
  const turm = technogymTurm(); turm.position.set(-0.64, 0, 0.05); turm.rotation.y = Math.PI / 2; g.add(turm);
  g.add(rohrzug([V(-0.2, 0.035, 0.09), V(-0.5, 0.035, 0.09)], R, M.rahmen));
  return { gruppe: g };
}

// Bewegliches Rollenpolster des Beinbeugers: liegt hinter den Unterschenkeln und hängt am Hebel, der am Knie dreht
export function beinbeugerHebel(rolle) {
  const g = new THREE.Group(), M = MATERIAL, B = BEINBEUGER;
  const polster = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.46, 26), M.polster); polster.rotation.z = Math.PI / 2; polster.position.copy(rolle); g.add(polster);
  for (const x of [-0.235, 0.235]) { const kappe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), M.rahmen); kappe.rotation.z = Math.PI / 2; kappe.position.set(x, rolle.y, rolle.z); g.add(kappe); }
  g.add(rohrzug([V(-0.3, B.knieY, B.knieZ), V(-0.3, rolle.y, rolle.z), V(-0.23, rolle.y, rolle.z)], 0.03, M.rahmen));
  return g;
}

// Adduktoren- und Abduktoren-Maschine (Technogym Selection, nach Foto): Sitz mit hoher zweiteiliger Lehne, Gewichtsturm vorn
// vor dem Sitzenden, dazwischen ein Bodenholm. Zwei Beinarme schwenken um senkrechte Achsen unter der Sitzvorderkante.
// Die beiden Geräte unterscheiden sich nur in der Lage der Kniepolster: außen (Abduktoren) oder innen (Adduktoren).
export function hueftmaschine3d(wurzel) {
  const g = new THREE.Group(), M = MATERIAL, R = 0.034;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  const anLehne = (netz, lokal) => { netz.position.copy(wurzel.localToWorld(lokal)); netz.quaternion.copy(wurzel.quaternion); g.add(netz); };
  dazu(kasten(0.42, 0.09, 0.42, M.polster, 0.04), 0, 0.51, 0.1);
  anLehne(kasten(0.34, 0.5, 0.08, M.polster, 0.04), V(0, 1.1, -0.19));
  anLehne(kasten(0.28, 0.24, 0.08, M.polster, 0.035), V(0, 1.5, -0.19));
  // Sitzträger: geschwungenes Rohr von der Lehne unter dem Sitz nach vorn zum Bodenholm
  g.add(rohrzug([wurzel.localToWorld(V(0, 1.55, -0.26)), wurzel.localToWorld(V(0, 0.8, -0.26)), V(0, 0.42, -0.22), V(0, 0.42, 0.2), V(0, 0.06, 0.3)], 0.04, M.rahmen));
  g.add(rohrzug([V(0, 0.05, -0.25), V(0, 0.05, 0.92)], 0.045, M.rahmen));
  g.add(rohrzug([V(-0.24, 0.035, -0.25), V(0.24, 0.035, -0.25)], R, M.rahmen));
  // Haltegriffe neben dem Sitz, gelber Verstellhebel
  for (const x of [-0.29, 0.29]) {
    g.add(rohrzug([V(x * 0.7, 0.46, 0.0), V(x, 0.56, 0.02), V(x, 0.62, 0.18)], 0.022, M.rahmen));
    g.add(stab(V(x, 0.6, 0.1), V(x, 0.62, 0.18), 0.024, M.gummi));
  }
  g.add(stab(V(0.16, 0.44, 0.3), V(0.3, 0.46, 0.34), 0.016, M.gelb));
  // Gewichtsturm vorn, Schlitz zum Sitzenden hin
  const turm = technogymTurm(); turm.position.set(0, 0, 1.08); turm.rotation.y = Math.PI; g.add(turm);
  return { gruppe: g, achse: { "-1": V(-0.09, 0.36, 0.3), "1": V(0.09, 0.36, 0.3) } };
}

// Beinarme für die aktuelle Beinstellung: vom Drehpunkt zum Kniepolster und weiter zur Fußstütze.
// punkte[s] = { knie, knoechel } in Weltkoordinaten; seite = 1: Polster außen am Knie (Abduktoren), -1: innen (Adduktoren).
export function beinarme(achse, punkte, seite) {
  const g = new THREE.Group(), M = MATERIAL;
  for (const s of [-1, 1]) {
    const { knie, knoechel } = punkte[s];
    const quer = V(s * seite, 0, 0);                                        // Richtung vom Knie zum Polster
    const polsterOrt = knie.clone().addScaledVector(quer, 0.105).add(V(0, 0.0, -0.03));
    const polster = kasten(0.06, 0.2, 0.22, M.polster, 0.028); polster.position.copy(polsterOrt);
    polster.rotation.y = Math.atan2(knie.x - achse[s].x, knie.z - achse[s].z); g.add(polster);
    const halter = polsterOrt.clone().addScaledVector(quer, 0.045);
    g.add(rohrzug([achse[s], V(achse[s].x, 0.42, achse[s].z), V(halter.x, 0.44, halter.z - 0.02), halter], 0.03, M.rahmen));
    // Fußstütze: Rohr vom Arm nach unten, Quersprosse unter der Fußsohle
    const sohle = knoechel.clone().add(V(0, -0.085, 0.07));
    g.add(rohrzug([V(halter.x, 0.44, halter.z - 0.02), V(halter.x, sohle.y, sohle.z), V(sohle.x - s * seite * 0.07, sohle.y, sohle.z)], 0.022, M.rahmen));
    g.add(stab(V(sohle.x - 0.06, sohle.y, sohle.z), V(sohle.x + 0.06, sohle.y, sohle.z), 0.024, M.gummi));
  }
  return g;
}

// Kurze gerade Stange am Kabel (Bizepscurls): läuft durch beide Hände, das Kabel hängt in der Mitte
export function kurzstange(austritt, griffLinks, griffRechts) {
  const g = new THREE.Group(), M = MATERIAL;
  const mitte = griffLinks.clone().lerp(griffRechts, 0.5), quer = griffRechts.clone().sub(griffLinks).normalize();
  const a = griffLinks.clone().addScaledVector(quer, -0.09), b = griffRechts.clone().addScaledVector(quer, 0.09);
  g.add(stab(a, b, 0.014, M.chrom));
  for (const hand of [griffLinks, griffRechts]) g.add(stab(hand.clone().addScaledVector(quer, -0.06), hand.clone().addScaledVector(quer, 0.06), 0.018, M.gummi));
  const oese = mitte.clone().add(austritt.clone().sub(mitte).normalize().multiplyScalar(0.05));
  g.add(stab(mitte, oese, 0.008, M.chrom));
  g.add(stab(oese, austritt, 0.004, M.kabel));
  return g;
}

// Einzelgriff am Kabel (Seitheben): Bügel mit Griffstück in der Hand
export function einzelgriff(austritt, hand) {
  const g = new THREE.Group(), M = MATERIAL;
  const zug = austritt.clone().sub(hand).normalize();
  let quer = zug.clone().cross(V(0, 0, 1)); if (quer.lengthSq() < 0.01) quer = V(1, 0, 0); quer.normalize();
  const a = hand.clone().addScaledVector(quer, -0.06), b = hand.clone().addScaledVector(quer, 0.06), spitze = hand.clone().addScaledVector(zug, 0.13);
  g.add(stab(a, b, 0.018, M.gummi));
  g.add(rohrzug([a, spitze, b], 0.007, M.chrom));
  g.add(stab(spitze, austritt, 0.004, M.kabel));
  return g;
}

// Kurzhantel-Regal wie im Studio: lang, drei schräge Ebenen, viele Hantelpaare von leicht (oben) bis schwer (unten)
export function hantelablage(hantel) {
  const g = new THREE.Group(), M = MATERIAL, breite = 2.5, proEbene = 12;
  const dazu = (netz, x, y, z) => { netz.position.set(x, y, z); g.add(netz); return netz; };
  for (const x of [-breite / 2, 0, breite / 2]) {
    g.add(stab(V(x, 0.03, 0.26), V(x, 1.02, -0.2), 0.03, M.rahmen));
    dazu(kasten(0.07, 0.05, 0.62, M.rahmen, 0.015), x, 0.025, 0.04);
  }
  // Ebenen: [Höhe, Tiefe, kleinste Größe, größte Größe]
  [[0.26, 0.2, 1.0, 1.4], [0.58, 0.06, 0.72, 1.0], [0.9, -0.08, 0.45, 0.7]].forEach(([y, z, von, bis]) => {
    const ebene = new THREE.Group(); ebene.position.set(0, y, z); ebene.rotation.x = 0.3; g.add(ebene);
    const brett = kasten(breite + 0.1, 0.03, 0.3, M.verkleidung, 0.01); ebene.add(brett);
    const kante = kasten(breite + 0.1, 0.05, 0.02, M.rahmen, 0.008); kante.position.set(0, 0.03, 0.15); ebene.add(kante);
    for (let i = 0; i < proEbene; i++) {
      const gr = von + (bis - von) * Math.floor(i / 2) / (proEbene / 2 - 1);   // paarweise gleiche Größe
      const h = hantel(); h.scale.setScalar(gr); h.rotation.y = Math.PI / 2;
      h.position.set(-breite / 2 + 0.13 + i * (breite - 0.26) / (proEbene - 1), 0.015 + 0.056 * gr, 0.02); ebene.add(h);
    }
  });
  return g;
}
