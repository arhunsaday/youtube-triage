// A tiny dependency-free RGBA rasteriser and PNG encoder.
//
// Brand icons must be reproducible on a clean CI runner, so nothing here may
// depend on a native image library. Shapes are sampled at SUPERSAMPLE x the
// target size and box-filtered down, which is what gives the rounded corners
// their antialiasing.
import { deflateSync } from 'node:zlib';

const SUPERSAMPLE = 4;

/** #rgb, #rrggbb and #rrggbbaa. */
export function parseColor(value) {
  let hex = String(value).replace('#', '');
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  if (hex.length === 6) hex += 'ff';
  if (!/^[0-9a-f]{8}$/i.test(hex)) throw new Error(`Bad colour: ${value}`);
  const n = parseInt(hex, 16);
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, (n & 255) / 255];
}

export function createCanvas(size) {
  const scale = SUPERSAMPLE;
  const w = size * scale;
  // Premultiplied RGBA. Source-over compositing is a plain lerp in this space,
  // and so is the box filter used when downsampling.
  const data = new Float32Array(w * w * 4);

  function blend(index, r, g, b, a) {
    const inv = 1 - a;
    data[index] = r * a + data[index] * inv;
    data[index + 1] = g * a + data[index + 1] * inv;
    data[index + 2] = b * a + data[index + 2] * inv;
    data[index + 3] = a + data[index + 3] * inv;
  }

  /** Fills every device pixel whose centre satisfies `inside`, within bounds. */
  function fill(bounds, inside, color) {
    const [r, g, b, a] = parseColor(color);
    const x0 = Math.max(0, Math.floor(bounds.x * scale));
    const y0 = Math.max(0, Math.floor(bounds.y * scale));
    const x1 = Math.min(w, Math.ceil((bounds.x + bounds.w) * scale));
    const y1 = Math.min(w, Math.ceil((bounds.y + bounds.h) * scale));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        if (inside((px + 0.5) / scale, (py + 0.5) / scale)) blend((py * w + px) * 4, r, g, b, a);
      }
    }
  }

  const api = {
    size,
    rect(x, y, width, height, color) {
      fill({ x, y, w: width, h: height }, () => true, color);
      return api;
    },
    roundRect(x, y, width, height, radius, color) {
      const r = Math.min(radius, width / 2, height / 2);
      fill(
        { x, y, w: width, h: height },
        (sx, sy) => {
          const dx = Math.max(x + r - sx, 0, sx - (x + width - r));
          const dy = Math.max(y + r - sy, 0, sy - (y + height - r));
          return dx * dx + dy * dy <= r * r;
        },
        color,
      );
      return api;
    },
    circle(cx, cy, radius, color) {
      fill(
        { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 },
        (sx, sy) => {
          const dx = sx - cx;
          const dy = sy - cy;
          return dx * dx + dy * dy <= radius * radius;
        },
        color,
      );
      return api;
    },
    /** Box-filters the supersampled buffer down and un-premultiplies. */
    toRGBA() {
      const out = Buffer.alloc(size * size * 4);
      const samples = scale * scale;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let r = 0,
            g = 0,
            b = 0,
            a = 0;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const i = ((y * scale + sy) * w + x * scale + sx) * 4;
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
              a += data[i + 3];
            }
          }
          r /= samples;
          g /= samples;
          b /= samples;
          a /= samples;
          const o = (y * size + x) * 4;
          out[o] = a > 0 ? Math.round(Math.min(255, r / a)) : 0;
          out[o + 1] = a > 0 ? Math.round(Math.min(255, g / a)) : 0;
          out[o + 2] = a > 0 ? Math.round(Math.min(255, b / a)) : 0;
          out[o + 3] = Math.round(Math.min(255, a * 255));
        }
      }
      return out;
    },
  };
  return api;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const tagged = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tagged));
  return Buffer.concat([length, tagged, crc]);
}

export function encodePng(rgba, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // Filter type 0 on every scanline. These are flat-colour images, so the
  // cleverer filters buy nothing worth the code.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
