import fs from 'fs';
import zlib from 'zlib';

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function createPng(width, height, pixelFn) {
  const rowBytes = width * 4 + 1;
  const uncompressed = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    uncompressed[rowStart] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      uncompressed[idx] = r;
      uncompressed[idx + 1] = g;
      uncompressed[idx + 2] = b;
      uncompressed[idx + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(uncompressed, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const chunks = [
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ];

  return Buffer.concat(chunks);
}

// Point-in-triangle test
function ptInTriangle(p, a, b, c) {
  const as_x = p[0] - a[0];
  const as_y = p[1] - a[1];
  const s_ab = (b[0] - a[0]) * as_y - (b[1] - a[1]) * as_x > 0;

  if ((c[0] - a[0]) * as_y - (c[1] - a[1]) * as_x > 0 === s_ab) return false;
  if ((c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]) > 0 !== s_ab) return false;
  return true;
}

// Point-in-polygon test (ray casting)
function ptInPolygon(p, vs) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > p[1]) !== (yj > p[1])) &&
        (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Generate brand icon
function drawBrandIcon(isMaskable) {
  return function(x, y, w, h) {
    const nx = x / w;
    const ny = y / h;

    // Corner radius for non-maskable
    if (!isMaskable) {
      const radius = 0.22;
      let outsideCorner = false;
      if (nx < radius && ny < radius && Math.hypot(nx - radius, ny - radius) > radius) outsideCorner = true;
      if (nx > 1 - radius && ny < radius && Math.hypot(nx - (1 - radius), ny - radius) > radius) outsideCorner = true;
      if (nx < radius && ny > 1 - radius && Math.hypot(nx - radius, ny - (1 - radius)) > radius) outsideCorner = true;
      if (nx > 1 - radius && ny > 1 - radius && Math.hypot(nx - (1 - radius), ny - (1 - radius)) > radius) outsideCorner = true;
      if (outsideCorner) return [0, 0, 0, 0];
    }

    // Background gradient: Deep slate #0f172a to Emerald #022c22
    const bgT = (nx + ny) / 2;
    const bgR = Math.round(15 + bgT * (2 - 15));
    const bgG = Math.round(23 + bgT * (44 - 23));
    const bgB = Math.round(42 + bgT * (34 - 42));

    // Logo bounds in normalized coordinates
    // Source logo coordinates are [18..135, 16..92] -> width 117, height 76
    const scale = isMaskable ? 0.0055 : 0.0066;
    const centerOffX = isMaskable ? (w * 0.5 - 77 * scale * w) : (w * 0.5 - 77 * scale * w);
    const centerOffY = isMaskable ? (h * 0.48 - 54 * scale * h) : (h * 0.48 - 54 * scale * h);

    const lx = (x - centerOffX) / (scale * w);
    const ly = (y - centerOffY) / (scale * h);

    // 1. R Stem: x: 18..31, y: 16..92
    if (lx >= 18 && lx <= 31 && ly >= 16 && ly <= 92) {
      const t = (ly - 16) / 76;
      return [Math.round(52 + t * (5 - 52)), Math.round(211 + t * (150 - 211)), Math.round(153 + t * (105 - 153)), 255];
    }

    // 2. R Top bar: x: 31..68, y: 16..28
    if (lx >= 31 && lx <= 68 && ly >= 16 && ly <= 28) {
      return [16, 185, 129, 255];
    }

    // 3. R Outer drop: x: 56..68, y: 28..44
    if (lx >= 56 && lx <= 68 && ly >= 28 && ly <= 44) {
      return [13, 148, 136, 255];
    }

    // 4. R Inner cutout: points [31,28], [56,28], [31,52] -> Cutout background
    const inCutout = ptInTriangle([lx, ly], [31, 28], [56, 28], [31, 52]);

    // 5. R Loop bottom: polygon points [31,52], [68,44], [56,58], [31,58]
    if (!inCutout && ptInPolygon([lx, ly], [[31, 52], [68, 44], [56, 58], [31, 58]])) {
      return [13, 148, 136, 255];
    }

    // 6. R Diagonal leg: polygon points [31,58], [45,58], [68,92], [52,92]
    if (ptInPolygon([lx, ly], [[31, 58], [45, 58], [68, 92], [52, 92]])) {
      return [5, 150, 105, 255];
    }

    // 7. M Left diagonal stem: polygon points [69,44], [82,44], [104,92], [91,92]
    if (ptInPolygon([lx, ly], [[69, 44], [82, 44], [104, 92], [91, 92]])) {
      const t = (ly - 44) / 48;
      return [Math.round(56 + t * (29 - 56)), Math.round(189 + t * (78 - 189)), Math.round(248 + t * (216 - 248)), 255];
    }

    // 8. M Middle V: polygon points [91,92], [104,92], [124,44], [111,44]
    if (ptInPolygon([lx, ly], [[91, 92], [104, 92], [124, 44], [111, 44]])) {
      return [37, 99, 235, 255];
    }

    // 9. M Right vertical stem: x: 121..135, y: 44..92
    if (lx >= 121 && lx <= 135 && ly >= 44 && ly <= 92) {
      return [29, 78, 216, 255];
    }

    // Border line for non-maskable
    if (!isMaskable) {
      const edgeDist = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edgeDist <= 2) {
        return [52, 211, 153, 90];
      }
    }

    return [bgR, bgG, bgB, 255];
  };
}

fs.writeFileSync('public/pwa-192x192.png', createPng(192, 192, drawBrandIcon(false)));
fs.writeFileSync('public/pwa-512x512.png', createPng(512, 512, drawBrandIcon(false)));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPng(512, 512, drawBrandIcon(true)));
fs.writeFileSync('public/apple-touch-icon.png', createPng(180, 180, drawBrandIcon(false)));
fs.writeFileSync('public/favicon.ico', createPng(48, 48, drawBrandIcon(false)));

console.log('Successfully generated all PWA icons!');
