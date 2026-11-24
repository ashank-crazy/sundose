// A small QR code encoder (byte mode, error correction level M, versions 1–10), so a printed
// notice-board sheet or a phone screen can hand the live forecast link to other phones.
// No library and no network: the code follows the QR specification (ISO/IEC 18004).

// Per version 1–10, level M: error-correction codewords per block, and number of blocks.
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const FORMAT_M = 0 // level M's two format bits are 00

function rawModules(ver) {
  let n = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const a = Math.floor(ver / 7) + 2
    n -= (25 * a - 10) * a - 55
    if (ver >= 7) n -= 36
  }
  return n
}
const dataCodewords = (ver) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * BLOCKS[ver]

// ---- Reed–Solomon over GF(256), polynomial 0x11D ----
function gfMul(x, y) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0)
  r[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root)
      if (j + 1 < r.length) r[j] ^= r[j + 1]
    }
    root = gfMul(root, 2)
  }
  return r
}
function rsRemainder(data, div) {
  const r = new Array(div.length).fill(0)
  for (const b of data) {
    const f = b ^ r.shift()
    r.push(0)
    div.forEach((c, i) => (r[i] ^= gfMul(c, f)))
  }
  return r
}

function encodeData(bytes, ver) {
  const bits = []
  const put = (v, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1)
  }
  put(0b0100, 4) // byte mode
  put(bytes.length, ver < 10 ? 8 : 16)
  for (const b of bytes) put(b, 8)
  const cap = dataCodewords(ver) * 8
  put(0, Math.min(4, cap - bits.length))
  put(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8)
  const out = []
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))
  return out
}

function interleave(data, ver) {
  const nBlocks = BLOCKS[ver]
  const eccLen = ECC_PER_BLOCK[ver]
  const raw = Math.floor(rawModules(ver) / 8)
  const nShort = nBlocks - (raw % nBlocks)
  const shortLen = Math.floor(raw / nBlocks)
  const div = rsDivisor(eccLen)
  const blocks = []
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, div)
    if (i < nShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const out = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= nShort) out.push(b[i])
    })
  }
  return out
}

function alignPositions(ver, size) {
  if (ver === 1) return []
  const n = Math.floor(ver / 7) + 2
  const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2
  const r = [6]
  for (let pos = size - 7; r.length < n; pos -= step) r.splice(1, 0, pos)
  return r
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function build(ver, codewords, mask) {
  const size = ver * 4 + 17
  const m = Array.from({ length: size }, () => new Array(size).fill(false))
  const fn = Array.from({ length: size }, () => new Array(size).fill(false))
  const set = (x, y, dark) => {
    m[y][x] = dark
    fn[y][x] = true
  }
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx
        const y = cy + dy
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4)
      }
  }
  const al = alignPositions(ver, size)
  for (let i = 0; i < al.length; i++)
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }

  // Format bits (level + mask, BCH-protected), drawn twice.
  const data = (FORMAT_M << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const fbits = ((data << 10) | rem) ^ 0x5412
  const bit = (v, i) => ((v >>> i) & 1) !== 0
  for (let i = 0; i <= 5; i++) set(8, i, bit(fbits, i))
  set(8, 7, bit(fbits, 6))
  set(8, 8, bit(fbits, 7))
  set(7, 8, bit(fbits, 8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(fbits, i))
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(fbits, i))
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(fbits, i))
  set(8, size - 8, true)

  if (ver >= 7) {
    let r = ver
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25)
    const vbits = (ver << 12) | r
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(a, b, bit(vbits, i))
      set(b, a, bit(vbits, i))
    }
  }

  // Data in the zig-zag order, then the mask over non-function modules.
  let k = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const up = ((right + 1) & 2) === 0
        const y = up ? size - 1 - v : v
        if (!fn[y][x] && k < codewords.length * 8) {
          m[y][x] = bit(codewords[k >>> 3], 7 - (k & 7))
          k++
        }
      }
  }
  const f = MASKS[mask]
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && f(x, y)) m[y][x] = !m[y][x]
  return m
}

// The four penalty rules from the specification; the mask with the lowest score is used.
function penalty(m) {
  const size = m.length
  let p = 0
  const lines = []
  for (let i = 0; i < size; i++) {
    lines.push(m[i])
    lines.push(m.map((row) => row[i]))
  }
  for (const line of lines) {
    let run = 1
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++
      else {
        if (run >= 5) p += run - 2
        run = 1
      }
    }
    const s = '0000' + line.map((d) => (d ? 1 : 0)).join('') + '0000'
    for (let i = s.indexOf('1011101'); i !== -1; i = s.indexOf('1011101', i + 1)) {
      if (s.slice(i - 4, i) === '0000' || s.slice(i + 7, i + 11) === '0000') p += 40
    }
  }
  let dark = 0
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (m[y][x]) dark++
      if (x < size - 1 && y < size - 1) {
        const c = m[y][x]
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3
      }
    }
  const total = size * size
  p += Math.ceil(Math.abs(dark * 20 - total * 10) / total - 1) * 10
  return p
}

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)]
  let ver = 1
  while (ver <= 10 && bytes.length + (ver < 10 ? 2 : 3) > dataCodewords(ver)) ver++
  if (ver > 10) throw new Error('Text too long for a QR code')
  const codewords = interleave(encodeData(bytes, ver), ver)
  let best = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const m = build(ver, codewords, mask)
    const score = penalty(m)
    if (score < bestScore) {
      best = m
      bestScore = score
    }
  }
  return best
}

// An SVG with a 4-module quiet zone, drawn as one path so it stays crisp when printed.
export function qrSvg(text, label = '') {
  const m = qrMatrix(text)
  const n = m.length + 8
  let d = ''
  m.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x + 4} ${y + 4}h1v1h-1z`
    }),
  )
  return `<svg class="qr" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
}
