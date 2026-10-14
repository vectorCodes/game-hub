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

/** The back: GameHub gold, a fine inner rule, a few sun and jade specks, and a light "?". */
const drawBack = (g: CanvasRenderingContext2D, s: number) => {
  const bg = g.createLinearGradient(0, 0, s, s);
  bg.addColorStop(0, "#e2a940");
  bg.addColorStop(1, "#c08424");
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);

  // A soft light from the top left.
  const glow = g.createRadialGradient(s * 0.3, s * 0.22, 0, s * 0.3, s * 0.22, s * 0.85);
  glow.addColorStop(0, "rgba(255,248,230,0.4)");
  glow.addColorStop(1, "rgba(255,248,230,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, s, s);

  // A printed grid, like the pages.
  g.strokeStyle = "rgba(42,34,22,0.08)";
  g.lineWidth = 2;
  for (let x = 64; x < s; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, s);
    g.moveTo(0, x);
    g.lineTo(s, x);
    g.stroke();
  }

  // Inner rule, and a dot seal in two corners.
  g.strokeStyle = "rgba(42,34,22,0.55)";
  g.lineWidth = 5;
  g.strokeRect(34, 34, s - 68, s - 68);
  g.fillStyle = "#d9582c";
  g.beginPath();
  g.arc(70, 70, 13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2f8a73";
  g.beginPath();
  g.arc(s - 70, s - 70, 13, 0, Math.PI * 2);
  g.fill();

  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `300 ${s * 0.6}px "Chakra Petch", "Arial", system-ui, sans-serif`;
  g.fillStyle = "#2a2216";
  g.fillText("?", s / 2, s / 2 + 12);
};
export const backTexture = canvas(512, drawBack);
// Drawn before the display font may have loaded: redraw once it's in.
void document.fonts?.load(`300 300px "Chakra Petch"`).then(() => {
  drawBack((backTexture.image as HTMLCanvasElement).getContext("2d")!, 512);
  backTexture.needsUpdate = true;
});

/** The night sky behind the board, painted into the scene so the canvas can be opaque. */
export const skyTexture = (() => {
  const tex = canvas(512, (g, s) => {
    const sky = g.createRadialGradient(s / 2, s * 0.12, 0, s / 2, s * 0.12, s * 0.95);
    sky.addColorStop(0, "#2c4743");
    sky.addColorStop(0.4, "#17302c");
    sky.addColorStop(0.75, "#0c1f1e");
    sky.addColorStop(1, "#081615");
    g.fillStyle = sky;
    g.fillRect(0, 0, s, s);
    // A gold sun-glow above the board.
    const sun = g.createRadialGradient(s * 0.5, s * 0.05, 0, s * 0.5, s * 0.05, s * 0.45);
    sun.addColorStop(0, "rgba(204,146,47,0.35)");
    sun.addColorStop(1, "rgba(204,146,47,0)");
    g.fillStyle = sun;
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
