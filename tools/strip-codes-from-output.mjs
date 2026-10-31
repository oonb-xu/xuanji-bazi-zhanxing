// 用户长期原则（2026-10-22）：**服务端返回给前端的数据里，一律不得出现项目编号**
// （R-G2 / R-G8 / R-G16 / R-G17 / 基线 v2.7 / hypothesis_under_validation 等）
// 理由：那些是开发内部术语，用户看不懂；服务端输出是对外契约，必须是自然语言。
// 注意：**代码注释里可以保留**（那是给开发者看的），只清"会被 JSON 序列化返回"的字符串。
import fs from 'node:fs';

let s = fs.readFileSync('server.mjs', 'utf8');
const before = s;
const fixed = [];

// ① timecheck 的 risk.why（返回给前端）
s = s.replace(
  '`上升在星座边界（${ascSign} ${ascDeg}°，±3 分钟即换座）⇒ 四轴类推论不可信（R-G8）`',
  '`上升在星座边界（${ascSign} ${ascDeg}°，±3 分钟即换座）⇒ 所有跟上升有关的结论都不可信`'
);
if (s !== before) fixed.push('timecheck risk.why');

// ② fusion.notes
s = s.replace(
  '耦合计算中已剔除（R-G8）。',
  '耦合计算中已剔除。'
);
s = s.replace(
  "'四轴（上升/下降/天顶/天底）对出生时刻极敏感（±3 分钟可能换座），耦合计算中已剔除。'",
  "'四轴（上升/下降/天顶/天底）对出生时刻极敏感（±3 分钟就可能换座），计算耦合度时已把它们排除在外。'"
);

// ③ m.note
s = s.replace(
  "note: '把三路证据折算成同尺度的\"标准分\"后加权求和，再过否决门槛。它不是准确率，也不是好坏。'",
  "note: '把三路证据折算成同一把尺子后加权求和，再过否决门槛。它不是准确率，也不代表好坏。'"
);

// ④ caveats
s = s.replace(
  "'本数值为**结构描述**，未经真实关系结局校准（R-G16 纪律）'",
  "'本数值是**结构描述**，没有用任何真实情侣的结局校准过'"
);

// ⑤ 提取度 / 星盘 / 适婚窗口 的 what 字段补白话（并确保无编号）
s = s.replace(
  "what: '两盘五行互相\"补\"了多少'",
  "what: '两盘互相补了多少（一方缺的，另一方正好有）'"
);

// ⑥ explain 里补上「互补度是什么」这一条（用户点名要解释）
if (!s.includes("'互补度是什么'")) {
  s = s.replace(
    "      '占比怎么读':",
    "      '互补度是什么': '它算的不是「你俩像不像」，而是**「你缺的我有没有」**：一方盘里偏弱、需要的五类元素（木火土金水），在另一方的盘里是否充足。数值越高说明互补越多。它是**双向**的——你补他的、他补你的，会分别计算。注意它衡量的是结构上的「能不能互相供给」，不是感情。',\n      '占比怎么读':"
  );
  fixed.push('explain 已补「互补度是什么」');
}

fs.writeFileSync('server.mjs', s, 'utf8');
console.log('已清理服务端输出中的项目编号：' + (fixed.length ? fixed.join('、') : '（见下）'));

// 复查：所有**字符串字面量**里不得再有编号
const code = fs.readFileSync('server.mjs', 'utf8');
const lines = code.split('\n');
const bad = [];
lines.forEach((ln, i) => {
  const t = ln.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;  // 注释允许
  if (/R-[A-Z]\d|基线 v\d|hypothesis_under_validation/.test(t)) bad.push('L' + (i + 1) + ': ' + t.slice(0, 90));
});
console.log(bad.length ? '⚠️ 非注释行仍有编号：\n  ' + bad.join('\n  ') : '✅ 非注释行（即会被返回的字符串）已无任何项目编号');
