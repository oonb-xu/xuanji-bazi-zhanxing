// 修正：行星全部回到**同一个黄道圆**上（直观优先），保留宫位/星座环
//   · 行星统一放在 0.86R 的圆上，与星座环对齐
//   · 轨道圈默认关闭（保留开关，供想看纵深时打开）
//   · 真实感球体渲染保留
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

/* ① 统一行星半径 */
if (!s.includes('PLANET_RING_R')) {
  s = s.replace(
    "const AU_MIN_LOG = 0, AU_MAX_LOG = Math.log10(41);",
    `const AU_MIN_LOG = 0, AU_MAX_LOG = Math.log10(41);
/** ★ 所有行星统一所在的那个圆（与星座环对齐，保证直观） */
const PLANET_RING_R = 0.86;`
  );
  console.log('① 统一半径常量已加');
}

/* ② 行星位置：改用统一半径 */
s = s.replace(
  "      const rr = orbitRadius(pl.name);\n      const v = mul(eclToVec(pl.lon), rr);",
  "      const rr = PLANET_RING_R;                 // ★ 同一个圆\n      const v = mul(eclToVec(pl.lon), rr);"
);

/* ③ 命中检测也改统一半径 */
s = s.replace(
  "    const s = proj(mul(eclToVec(pl.lon), orbitRadius(pl.name)));",
  "    const s = proj(mul(eclToVec(pl.lon), PLANET_RING_R));"
);

/* ④ 恒等连线端点改统一半径 */
s = s.replace(
  "    const b = proj(mul(eclToVec(DATA.sunLon), orbitRadius('太阳')));",
  "    const b = proj(mul(eclToVec(DATA.sunLon), PLANET_RING_R));"
);

/* ⑤ 轨道圈默认关闭（想看纵深再手动开） */
s = s.replace(
  "const show = { stars: true, zodiac: true, pillars: true, planets: true, houses: true, bagua: true, ecliptic: true, orbits: true };",
  "const show = { stars: true, zodiac: true, pillars: true, planets: true, houses: true, bagua: true, ecliptic: true, orbits: false };"
);

/* ⑥ 轨道圈的判定改为只看开关 */
s = s.replace(
  "  if (show.planets && show.orbits !== false) {",
  "  if (show.orbits) {"
);

/* ⑦ 行星半径：统一圆上，尺寸按"真实相对大小"但压缩，避免木星过大 */
s = s.replace(
  "      let pr = baseR * sc.s * 0.0150;",
  "      // 真实相对尺寸（木星/土星大、水星小），再压缩动态范围\n      let pr = (1.6 + baseR * 2.6) * 0.0042 * Math.min(sc.s, 900);"
);

/* ⑧ 星座环稍微外移，避免和行星重叠 */
s = s.replace(
  "      const vg = proj(mul(eclToVec(lon + 15), 0.98));",
  "      const vg = proj(mul(eclToVec(lon + 15), 1.02));"
);
s = s.replace(
  "      const vn = proj(mul(eclToVec(lon + 15), 0.87));",
  "      const vn = proj(mul(eclToVec(lon + 15), 0.95));"
);
s = s.replace(
  "      spoke3D(lon, 0.80, 0.92, hot ? '#5ef1ff' : 'rgba(0,229,255,0.20)', hot ? 2 : 0.9);",
  "      spoke3D(lon, 0.62, 0.98, hot ? '#5ef1ff' : 'rgba(0,229,255,0.20)', hot ? 2 : 0.9);"
);

/* ⑨ 星座命中检测同步 */
s = s.replace(
  "    const s = proj(mul(eclToVec(i * 30 + 15), 0.98));",
  "    const s = proj(mul(eclToVec(i * 30 + 15), 1.02));"
);

/* ⑩ 宫位环：画出编号 + 领域，范围 0.62–0.86 */
s = s.replace(
  "      spoke3D(c0, 0.62, 0.80, h === 0 ? 'rgba(255,196,87,0.55)' : 'rgba(0,229,255,0.12)', h === 0 ? 1.6 : 0.8);\n      const vd = proj(mul(eclToVec(mid), 0.70));\n      if (vd.z > 0.02 && vd.s > 30) txt(HOUSE_DOMAIN[h + 1], vd.x, vd.y, { color: 'rgba(170,215,240,0.55)', size: 8 });",
  `      spoke3D(c0, 0.58, 0.98, h === 0 ? 'rgba(255,196,87,0.60)' : 'rgba(0,229,255,0.11)', h === 0 ? 1.8 : 0.75);
      const vd = proj(mul(eclToVec(mid), 0.74));
      if (vd.z > 0.02 && vd.s > 26) {
        txt(String(h + 1), vd.x, vd.y - 7, { color: 'rgba(255,196,87,0.50)', size: 8 });
        txt(HOUSE_DOMAIN[h + 1], vd.x, vd.y + 4, { color: 'rgba(180,222,245,0.62)', size: 7.5 });
      }`
);

fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('②–⑩ 修正完成：行星回到同一圆 + 宫位环恢复');
