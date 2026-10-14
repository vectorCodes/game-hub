// Tile art, drawn once on canvases (no image files to load): the "?" back, the soft glow
// the pair colour tints on the front, and the rounded-square shape both are cut to.
import { CanvasTexture, Shape, ShapeGeometry, SRGBColorSpace, type BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { TILE } from "../config";

function canvas(size: number, draw: (g: CanvasRenderingContext2D, size: number) => void) {
  const el = document.createElement("canvas");
  el.width = el.height = size;
  draw(el.getContext("2d")!, size);
  const tex = new CanvasTexture(el);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The back: a candy gradient, confetti specks, and a chunky "?" with a drop shadow. */
export const backTexture = canvas(512, (g, s) => {
  const bg = g.createLinearGradient(0, 0, s, s);
  bg.addColorStop(0, "#7c6cff");
  bg.addColorStop(0.55, "#5a8dff");
  bg.addColorStop(1, "#38c8e8");
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);

  // A soft light from the top left.
  const glow = g.createRadialGradient(s * 0.3, s * 0.25, 0, s * 0.3, s * 0.25, s * 0.8);
  glow.addColorStop(0, "rgba(255,255,255,0.35)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, s, s);

  // Confetti, placed by a fixed pattern so every back looks the same.
  const specks = ["#ffd84d", "#ff7a8a", "#7ddc6f", "#ffffff", "#ffb340"];
  let r = 7;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 46; i++) {
    g.save();
    g.translate(rand() * s, rand() * s);
    g.rotate(rand() * Math.PI);
    g.globalAlpha = 0.55 + rand() * 0.4;
    g.fillStyle = specks[i % specks.length];
    if (i % 3 === 0) {
      g.beginPath();
      g.arc(0, 0, 5 + rand() * 4, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(-9, -3.5, 18, 7);
    }
    g.restore();
  }
  g.globalAlpha = 1;

  // Inner border.
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 10;
  g.beginPath();
  g.roundRect(26, 26, s - 52, s - 52, 54);
  g.stroke();

  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `900 ${s * 0.56}px "Bricolage Grotesque", "Arial Black", system-ui, sans-serif`;
  g.fillStyle = "rgba(20,10,70,0.35)";
  g.fillText("?", s / 2 + 8, s / 2 + 22);
  g.fillStyle = "#ffffff";
  g.fillText("?", s / 2, s / 2 + 10);
});

/** The sky behind the board, painted into the scene so the canvas can be opaque. */
export const skyTexture = (() => {
  const tex = canvas(512, (g, s) => {
    const sky = g.createRadialGradient(s / 2, s * 0.15, 0, s / 2, s * 0.15, s * 0.95);
    sky.addColorStop(0, "#9a7dff");
    sky.addColorStop(0.38, "#6a4ae6");
    sky.addColorStop(0.72, "#3a1f9e");
    sky.addColorStop(1, "#1c0e5a");
    g.fillStyle = sky;
    g.fillRect(0, 0, s, s);
  });
  tex.anisotropy = 1;
  return tex;
})();

/** The front, in greys for the pair colour to tint: bright in the middle, darker rim, dots. */
export const faceTexture = canvas(256, (g, s) => {
  const bg = g.createRadialGradient(s / 2, s * 0.42, s * 0.05, s / 2, s / 2, s * 0.72);
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(1, "#c9c9c9");
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);
  g.fillStyle = "rgba(255,255,255,0.45)";
  for (let y = 18; y < s; y += 32) {
    for (let x = (y / 32) % 2 ? 18 : 34; x < s; x += 32) {
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(14, 14, s - 28, s - 28, 28);
  g.stroke();
});

/** A flat rounded square in the XZ plane facing +Y, with 0–1 UVs across it. */
function roundedSquare(size: number, radius: number): BufferGeometry {
  const h = size / 2;
  const shape = new Shape();
  shape.moveTo(-h + radius, -h);
  shape.lineTo(h - radius, -h);
  shape.quadraticCurveTo(h, -h, h, -h + radius);
  shape.lineTo(h, h - radius);
  shape.quadraticCurveTo(h, h, h - radius, h);
  shape.lineTo(-h + radius, h);
  shape.quadraticCurveTo(-h, h, -h, h - radius);
  shape.lineTo(-h, -h + radius);
  shape.quadraticCurveTo(-h, -h, -h + radius, -h);
  const geo = new ShapeGeometry(shape, 8);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + h) / size, (pos.getY(i) + h) / size);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export const tileGeometry = new RoundedBoxGeometry(TILE.size, TILE.thickness, TILE.size, 4, TILE.radius);
export const faceGeometry = roundedSquare(TILE.size * 0.88, TILE.radius * 0.9);
