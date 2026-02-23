/**
 * generate-icons.mjs
 * Generates all PNG assets required for Chrome Web Store publication.
 *
 * Design: Light & Fresh — white/light-blue background, blue browser-tab shapes,
 *         red × badge indicating "duplicate removal".
 *
 * Outputs:
 *   public/icons/icon16.png
 *   public/icons/icon32.png
 *   public/icons/icon48.png
 *   public/icons/icon128.png
 *   store/promo-tile.png   (440x280, required by Chrome Web Store)
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  bgLight:   '#EFF6FF',   // blue-50  — icon background
  promoFrom: '#F0F7FF',   // promo tile gradient start
  promoTo:   '#E8F0FE',   // promo tile gradient end
  tabFront:  '#3B82F6',   // blue-500 — main (kept) tab
  tabBack:   '#BFDBFE',   // blue-200 — duplicate (to-be-removed) tab
  badge:     '#EF4444',   // red-500  — kill badge
  white:     '#FFFFFF',
  textHead:  '#1E3A8A',   // blue-900
  textSub:   '#2563EB',   // blue-600
  textBody:  '#475569',   // slate-600
  divider:   '#DBEAFE',   // blue-100
};

// ---------------------------------------------------------------------------
// Icon SVG  (128×128 canvas)
//
// Visual story: two stacked browser-tab shapes (the classic rectangle-with-ear
// silhouette). The back tab is light blue = the duplicate. The front tab is
// vivid blue = the one being kept. A red circle badge with a white × sits at
// the bottom-right corner = "killing" the duplicate.
// ---------------------------------------------------------------------------
const iconSvg = `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">

  <!-- Background -->
  <rect width="128" height="128" rx="22" fill="${C.bgLight}"/>

  <!-- ── Duplicate tab (back / lighter) ─────────────────────────────── -->
  <!-- Tab handle (ear) -->
  <rect x="30" y="34" width="26" height="14" rx="4" fill="${C.tabBack}"/>
  <!-- Connect handle → body (no visible gap) -->
  <rect x="30" y="44" width="26" height="5"  fill="${C.tabBack}"/>
  <!-- Tab body -->
  <rect x="30" y="46" width="66" height="48" rx="7" fill="${C.tabBack}"/>

  <!-- ── Main tab (front / vivid blue) ──────────────────────────────── -->
  <!-- Tab handle (ear) -->
  <rect x="20" y="28" width="30" height="15" rx="5" fill="${C.tabFront}"/>
  <!-- Connect handle → body -->
  <rect x="20" y="40" width="30" height="5"  fill="${C.tabFront}"/>
  <!-- Tab body -->
  <rect x="20" y="42" width="74" height="50" rx="7" fill="${C.tabFront}"/>
  <!-- Subtle address-bar separator inside the tab -->
  <rect x="20" y="55" width="74" height="2"  fill="${C.white}" opacity="0.22"/>
  <!-- Two short content lines (conveys "real page content") -->
  <rect x="30" y="64" width="44" height="5"  rx="2.5" fill="${C.white}" opacity="0.35"/>
  <rect x="30" y="75" width="28" height="5"  rx="2.5" fill="${C.white}" opacity="0.22"/>

  <!-- ── Kill badge ──────────────────────────────────────────────────── -->
  <circle cx="90" cy="83" r="19" fill="${C.badge}"/>
  <!-- Subtle inner ring for depth -->
  <circle cx="90" cy="83" r="19" fill="none" stroke="${C.white}" stroke-width="1.5" opacity="0.25"/>
  <!-- White × -->
  <path d="M83 76 L97 90 M97 76 L83 90"
        stroke="${C.white}" stroke-width="4" stroke-linecap="round"/>

</svg>`;

// ---------------------------------------------------------------------------
// Promo tile SVG  (440×280)
//
// Layout: scaled icon on the left, text hierarchy on the right.
// Same light-and-fresh color language as the icon.
// ---------------------------------------------------------------------------
const promoSvg = `<svg width="440" height="280" viewBox="0 0 440 280" fill="none" xmlns="http://www.w3.org/2000/svg">

  <defs>
    <!-- Very subtle gradient background -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="440" y2="280" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="${C.promoFrom}"/>
      <stop offset="100%" stop-color="${C.promoTo}"/>
    </linearGradient>
    <!-- Soft blue glow behind icon -->
    <radialGradient id="iconGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${C.tabFront}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${C.tabFront}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="440" height="280" fill="url(#bgGrad)"/>

  <!-- Decorative soft circles -->
  <circle cx="0"   cy="0"   r="160" fill="${C.tabFront}" opacity="0.04"/>
  <circle cx="440" cy="280" r="180" fill="${C.tabFront}" opacity="0.05"/>

  <!-- ── Icon area (left, scaled 1.28× so 128→164px, centred vertically) ── -->
  <rect x="12" y="58" width="164" height="164" rx="28" fill="url(#iconGlow)"/>

  <g transform="translate(12,58) scale(1.28125)">
    <!-- Background -->
    <rect width="128" height="128" rx="22" fill="${C.bgLight}"/>
    <!-- Drop shadow effect via a rect -->
    <rect width="128" height="128" rx="22" fill="none" stroke="${C.tabBack}" stroke-width="1.5" opacity="0.6"/>

    <!-- Duplicate tab (back) -->
    <rect x="30" y="34" width="26" height="14" rx="4" fill="${C.tabBack}"/>
    <rect x="30" y="44" width="26" height="5"  fill="${C.tabBack}"/>
    <rect x="30" y="46" width="66" height="48" rx="7" fill="${C.tabBack}"/>

    <!-- Main tab (front) -->
    <rect x="20" y="28" width="30" height="15" rx="5" fill="${C.tabFront}"/>
    <rect x="20" y="40" width="30" height="5"  fill="${C.tabFront}"/>
    <rect x="20" y="42" width="74" height="50" rx="7" fill="${C.tabFront}"/>
    <rect x="20" y="55" width="74" height="2"  fill="${C.white}" opacity="0.22"/>
    <rect x="30" y="64" width="44" height="5"  rx="2.5" fill="${C.white}" opacity="0.35"/>
    <rect x="30" y="75" width="28" height="5"  rx="2.5" fill="${C.white}" opacity="0.22"/>

    <!-- Kill badge -->
    <circle cx="90" cy="83" r="19" fill="${C.badge}"/>
    <circle cx="90" cy="83" r="19" fill="none" stroke="${C.white}" stroke-width="1.5" opacity="0.25"/>
    <path d="M83 76 L97 90 M97 76 L83 90"
          stroke="${C.white}" stroke-width="4" stroke-linecap="round"/>
  </g>

  <!-- Vertical divider -->
  <line x1="200" y1="48" x2="200" y2="232" stroke="${C.divider}" stroke-width="1.5"/>

  <!-- ── Text (right) ──────────────────────────────────────────────── -->

  <!-- App name -->
  <text x="220" y="118"
    fill="${C.textHead}"
    font-family="Helvetica Neue, Arial, sans-serif"
    font-size="21" font-weight="700" letter-spacing="-0.4">Duplicate Tabs Killer</text>

  <!-- Tagline -->
  <text x="220" y="142"
    fill="${C.textSub}"
    font-family="PingFang SC, Noto Sans CJK SC, Helvetica Neue, Arial, sans-serif"
    font-size="13">自动检测并关闭重复标签页</text>

  <!-- Divider under tagline -->
  <line x1="220" y1="156" x2="418" y2="156" stroke="${C.divider}" stroke-width="1"/>

  <!-- Feature list -->
  <circle cx="229" cy="175" r="3.5" fill="${C.tabFront}" opacity="0.75"/>
  <text x="241" y="180"
    fill="${C.textBody}"
    font-family="PingFang SC, Noto Sans CJK SC, Helvetica Neue, Arial, sans-serif"
    font-size="12.5">智能识别并自动关闭重复标签</text>

  <circle cx="229" cy="200" r="3.5" fill="${C.tabFront}" opacity="0.75"/>
  <text x="241" y="205"
    fill="${C.textBody}"
    font-family="PingFang SC, Noto Sans CJK SC, Helvetica Neue, Arial, sans-serif"
    font-size="12.5">支持标签分组与归档管理</text>

  <circle cx="229" cy="225" r="3.5" fill="${C.tabFront}" opacity="0.75"/>
  <text x="241" y="230"
    fill="${C.textBody}"
    font-family="PingFang SC, Noto Sans CJK SC, Helvetica Neue, Arial, sans-serif"
    font-size="12.5">轻量运行，不影响浏览器性能</text>

</svg>`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const iconsDir = join(rootDir, 'public', 'icons');
  const storeDir = join(rootDir, 'store');

  await mkdir(iconsDir, { recursive: true });
  await mkdir(storeDir, { recursive: true });

  // Icon PNGs
  for (const size of [16, 32, 48, 128]) {
    await sharp(Buffer.from(iconSvg))
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(join(iconsDir, `icon${size}.png`));
    console.log(`✓ icons/icon${size}.png`);
  }

  // Promotional tile
  await sharp(Buffer.from(promoSvg))
    .resize(440, 280)
    .png({ compressionLevel: 9 })
    .toFile(join(storeDir, 'promo-tile.png'));
  console.log('✓ store/promo-tile.png');

  // Save SVG sources for future editing
  await writeFile(join(iconsDir, 'icon.svg'),        iconSvg,  'utf-8');
  await writeFile(join(storeDir,  'promo-tile.svg'), promoSvg, 'utf-8');
  console.log('✓ SVG sources saved');

  console.log('\nAll done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
