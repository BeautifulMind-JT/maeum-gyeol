import {deflateSync, inflateSync} from 'node:zlib';

export const STORE_DEVICES = [
  {id: 'iphone-6.9', dir: 'store/screenshots/iphone-6.9', width: 1320, height: 2868, cssWidth: 440, cssHeight: 956, scale: 3},
  {id: 'ipad-13', dir: 'store/screenshots/ipad-13', width: 2064, height: 2752, cssWidth: 1032, cssHeight: 1376, scale: 2},
];

export const STORE_SCREENS = [
  {file: '01-today.png', name: 'today'},
  {file: '02-practice.png', name: 'practice'},
  {file: '03-journal.png', name: 'journal'},
  {file: '04-library.png', name: 'library'},
  {file: '05-community.png', name: 'community'},
  {file: '06-settings.png', name: 'settings'},
];

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function readChunks(bytes) {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(SIG)) throw Error('not a PNG');
  const chunks = [];
  for (let i = 8; i < bytes.length;) {
    const length = bytes.readUInt32BE(i);
    const type = bytes.subarray(i + 4, i + 8).toString('binary');
    const data = bytes.subarray(i + 8, i + 8 + length);
    chunks.push({type, data});
    i += 12 + length;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function unfilter(bytes, width, height, bpp) {
  const stride = width * bpp, row = stride + 1, pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = bytes[y * row], src = y * row + 1, dest = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw = bytes[src + x];
      const left = x >= bpp ? pixels[dest + x - bpp] : 0;
      const up = y ? pixels[dest - stride + x] : 0;
      const upLeft = y && x >= bpp ? pixels[dest - stride + x - bpp] : 0;
      pixels[dest + x] = (raw + (filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? paeth(left, up, upLeft) : 0)) & 255;
    }
  }
  return pixels;
}

export function inspectPng(bytes) {
  const chunks = readChunks(bytes);
  const ihdr = chunks.find(c => c.type === 'IHDR');
  if (!ihdr || ihdr.data.length < 13) throw Error('PNG is missing IHDR');
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  return {
    width,
    height,
    bitDepth,
    colorType,
    hasAlphaChunk: chunks.some(c => c.type === 'tRNS'),
    types: chunks.map(c => c.type),
  };
}

export function pngToOpaqueRgb(bytes) {
  const chunks = readChunks(bytes);
  const ihdr = chunks.find(c => c.type === 'IHDR');
  if (!ihdr) throw Error('PNG is missing IHDR');
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8], colorType = ihdr.data[9], interlace = ihdr.data[12];
  if (bitDepth !== 8 || interlace) throw Error('only 8-bit non-interlaced PNG is supported');
  if (chunks.some(c => c.type === 'tRNS')) throw Error('PNG uses a tRNS transparency chunk');
  if (colorType === 2 && !chunks.some(c => c.type === 'tRNS')) {
    const rebuilt = encodeRgbPng(width, height, unfilter(inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data))), width, height, 3));
    return rebuilt;
  }
  if (colorType !== 6) throw Error('PNG color type ' + colorType + ' is not RGB or RGBA');
  const rgba = unfilter(inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data))), width, height, 4);
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    if (rgba[i + 3] !== 255) throw Error('PNG has a transparent or semitransparent pixel');
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  return encodeRgbPng(width, height, rgb);
}

export function encodeRgbPng(width, height, rgb) {
  const stride = width * 3, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}
