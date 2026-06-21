// One-off icon rasterizer: master SVG → PWA PNG icons. Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const master = readFileSync(join(root, 'public', 'logo-master.svg'))

const targets = [
  { out: 'public/icon-192.png', size: 192 },
  { out: 'public/icon-512.png', size: 512 },
  { out: 'public/icon-512-maskable.png', size: 512 }, // master already has safe-zone padding
  { out: 'src/app/apple-icon.png', size: 180 },
]

for (const { out, size } of targets) {
  await sharp(master).resize(size, size).png().toFile(join(root, out))
  console.log('wrote', out, `${size}x${size}`)
}
console.log('done')
