// VedAstro 数据集适配层
// 来源：VedAstro（非营利、MIT） 15,807 位名人的出生日期/时刻/地点
//   https://huggingface.co/datasets/vedastro-org/15000-Famous-People-Birth-Date-Location
//   本机 HuggingFace 直连不通 → 用镜像 hf-mirror.com 下载 PersonList-15k.csv
// 记录形态：RowKey, BirthTime(JSON: {StdTime:"HH:MM DD/MM/YYYY ±HH:MM", Location:{Name,Longitude,Latitude}}), Gender, Name, Notes
// ★ 该数据集的时差是**显式给出**且按 DST 校正过的，且标注 Rodden AA（出生证明级）—— 这是我们能拿到的最可靠的星盘输入。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROJ = resolve(HERE, '../..');
export const VEDASTRO_CSV = join(PROJ, 'data', 'vedastro', 'PersonList-15k.csv');

/** 解析 "19:55 26/06/1954 +01:00"（也兼容 LMT 写法如 "+00:18" = 0时18分）
 *  ★ 坑：正则里符号必须**单独成组**。首版写成 `([+-]\d{1,2})` 使符号与小时同组，
 *    导致解构整体错位一格 —— `+01:00` 被读成 0 时差、`+00:18` 被读成 18 小时。
 *    这类错误**不报错**，只会让 1.2 万条盘悄悄算错。 */
export function parseStdTime(s) {
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s*([+-])(\d{1,2}):?(\d{2})?$/);
  if (!m) return null;
  const [, H, Mi, D, Mo, Y, sign, oh, om] = m;
  const off = (sign === '-' ? -1 : 1) * (Number(oh) + Number(om ?? 0) / 60);
  if (!Number.isFinite(off) || Math.abs(off) > 14) return null;              // 地球上不存在 |时差|>14
  return {
    date: `${Y}-${String(Mo).padStart(2, '0')}-${String(D).padStart(2, '0')}`,
    time: `${String(H).padStart(2, '0')}:${Mi}`,
    offsetHours: Math.round(off * 1000) / 1000,
  };
}

/** 读全量并归一化。跳过解析失败者并统计（不静默丢） */
export function loadVedastro(path = VEDASTRO_CSV) {
  if (!existsSync(path)) throw new Error(`找不到 VedAstro 数据：${path}\n下载：Invoke-WebRequest "https://hf-mirror.com/datasets/vedastro-org/15000-Famous-People-Birth-Date-Location/resolve/main/PersonList-15k.csv" -OutFile data/vedastro/PersonList-15k.csv`);
  const rows = parse(readFileSync(path, 'utf8'), { columns: true, skip_empty_lines: true, relax_quotes: true });
  const out = [], bad = [];
  for (const r of rows) {
    try {
      const bt = JSON.parse(r.BirthTime);
      const st = parseStdTime(bt?.StdTime);
      const loc = bt?.Location ?? {};
      if (!st || typeof loc.Longitude !== 'number' || typeof loc.Latitude !== 'number') throw new Error('字段缺失');
      out.push({
        id: r.RowKey, name: r.Name, gender: r.Gender === 'Female' ? '女' : r.Gender === 'Male' ? '男' : null,
        date: st.date, time: st.time, offsetHours: st.offsetHours,
        lon: loc.Longitude, lat: loc.Latitude, place: loc.Name ?? null,
        notes: r.Notes || null,
        // Astro-Databank 的 Rodden 评级：Notes 形如 {'rodden': 'AA'}
        // ★ 不要用 JSON.parse（含撇号/多键的记录会整条解析失败 → 首版只认出 648/15790）
        //   改用正则提取，JSON.parse 仅作兜底
        rodden: (() => {
          const s = String(r.Notes ?? '');
          const m = s.match(/rodden['"]?\s*[:=]\s*['"]?\s*([A-Za-z]{1,3})/);
          if (m) return m[1].toUpperCase();
          try { return JSON.parse(s.replace(/'/g, '"'))?.rodden ?? null; } catch { return null; }
        })(),
        tzName: offsetToIana(st.offsetHours, loc.Longitude),
      });
    } catch (e) { bad.push({ row: r.RowKey, err: e.message }); }
  }
  return { records: out, bad, total: rows.length };
}

/** 由显式时差 + 经度猜一个 IANA 名（只为了走 R-W8 历史规则；猜不到就用固定偏移） */
function offsetToIana(off, lon) {
  const table = [
    [0, 'UTC'], [1, 'Europe/London'], [2, 'Europe/Paris'], [-5, 'America/New_York'], [-6, 'America/Chicago'],
    [-7, 'America/Denver'], [-8, 'America/Los_Angeles'], [9, 'Asia/Tokyo'], [8, 'Asia/Shanghai'], [10, 'Australia/Sydney'],
    [5.5, 'Asia/Kolkata'], [-3, 'America/Sao_Paulo'], [3, 'Europe/Moscow'],
  ];
  const hit = table.find(([h]) => Math.abs(h - off) < 0.01);
  if (!hit) return null;
  // 东八区只有东亚用，避免把新加坡/珀斯误判成中国（真太阳时只需经度+时差，不影响正确性）
  if (hit[1] === 'Asia/Shanghai' && (lon < 73 || lon > 135)) return null;
  return hit[1];
}

/** 转成本项目的 Sample_Input（复用既有采集链路） */
export function toSampleInput(rec, { lifeEvents = [] } = {}) {
  return {
    name: rec.name, gender: rec.gender ?? '男',
    birth_date: {
      calendar: '公历', date: rec.date, time: rec.time, time_precision: '精确到分',
      birth_place: {
        city: rec.place, province: null,
        longitude: rec.lon, latitude: rec.lat,
        // ★ 只给显式时差时**不要**拼 'UTC-4' 这类假 IANA 名——Intl 会抛 Invalid time zone，
        //   必须走 utc_offset_hours 数值通道（采样链路已支持）
        timezone: rec.tzName,
        utc_offset_hours: rec.offsetHours,
      },
    },
    life_events: lifeEvents,
    note: `VedAstro 数据集 ${rec.id}（Rodden AA 级）｜显式时差 ${rec.offsetHours}h`,
    _vedastro: { id: rec.id, offsetHours: rec.offsetHours, notes: rec.notes },
  };
}

export function datasetStats(records) {
  const byGender = {}, byDecade = {}, byOffset = {};
  for (const r of records) {
    byGender[r.gender ?? '未知'] = (byGender[r.gender ?? '未知'] ?? 0) + 1;
    const dec = `${Math.floor(Number(r.date.slice(0, 4)) / 10) * 10}s`;
    byDecade[dec] = (byDecade[dec] ?? 0) + 1;
    byOffset[`${r.offsetHours}h`] = (byOffset[`${r.offsetHours}h`] ?? 0) + 1;
  }
  return { total: records.length, byGender, byDecade, byOffset };
}
