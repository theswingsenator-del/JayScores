import * as THREE from "three";

/** Procedural pitch texture: mowing stripes + white line markings. */
export function makePitchTexture(w = 1024, h = 660): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  // grass stripes
  const stripes = 12;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? "#0b3d1f" : "#0e4a26";
    ctx.fillRect((w / stripes) * i, 0, w / stripes + 1, h);
  }

  // markings
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 3;
  const m = 30; // margin
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  // halfway line + center circle
  ctx.beginPath();
  ctx.moveTo(w / 2, m);
  ctx.lineTo(w / 2, h - m);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
  // penalty boxes
  const boxW = 140, boxH = 320, gaW = 55, gaH = 160;
  ctx.strokeRect(m, (h - boxH) / 2, boxW, boxH);
  ctx.strokeRect(w - m - boxW, (h - boxH) / 2, boxW, boxH);
  ctx.strokeRect(m, (h - gaH) / 2, gaW, gaH);
  ctx.strokeRect(w - m - gaW, (h - gaH) / 2, gaW, gaH);
  // penalty spots + arcs
  for (const x of [m + 95, w - m - 95]) {
    ctx.beginPath();
    ctx.arc(x, h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(m + 95, h / 2, 60, -0.9, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w - m - 95, h / 2, 60, Math.PI - 0.9, Math.PI + 0.9);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/** Heatmap texture: attack intensity glow toward each goal, scaled by expected
 * goals. Home attacks right (cyan), away attacks left (magenta). */
export function makeHeatmapTexture(
  lambdaHome: number,
  lambdaAway: number,
  w = 512,
  h = 330
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  const norm = (v: number) => Math.min(v / 3.2, 1); // 3.2 xG ≈ max glow

  // home attacking right goal
  const gh = ctx.createRadialGradient(w * 0.94, h / 2, 10, w * 0.94, h / 2, w * 0.55);
  gh.addColorStop(0, `rgba(0,229,255,${0.75 * norm(lambdaHome)})`);
  gh.addColorStop(0.5, `rgba(0,229,255,${0.28 * norm(lambdaHome)})`);
  gh.addColorStop(1, "rgba(0,229,255,0)");
  ctx.fillStyle = gh;
  ctx.fillRect(0, 0, w, h);

  // away attacking left goal
  const ga = ctx.createRadialGradient(w * 0.06, h / 2, 10, w * 0.06, h / 2, w * 0.55);
  ga.addColorStop(0, `rgba(255,46,196,${0.75 * norm(lambdaAway)})`);
  ga.addColorStop(0.5, `rgba(255,46,196,${0.28 * norm(lambdaAway)})`);
  ga.addColorStop(1, "rgba(255,46,196,0)");
  ctx.fillStyle = ga;
  ctx.fillRect(0, 0, w, h);

  return new THREE.CanvasTexture(c);
}
