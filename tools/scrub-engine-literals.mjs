// 清除引擎/CLI 文件里的真实生辰字面量（均为注释或 CLI 默认参数，不涉及算法）
import fs from 'node:fs';

const PATCHES = [
  {
    file: 'src/western/truesolar.mjs',
    pairs: [
      ['（第一版多加了 tz 偏移，把 2007-12-25 16:26 写成了次日 00:26）', '（第一版多加了 tz 偏移，把当日 16:26 写成了次日 00:26）'],
    ],
  },
  {
    file: 'cli-dayun-align.mjs',
    pairs: [
      ['//   node cli-dayun-align.mjs --a "2007-12-25 16:26" --a-date 2007-12-25 --a-sex 男 \\', '//   node cli-dayun-align.mjs --a "1990-03-15 12:00" --a-date 1990-03-15 --a-sex 男 \\'],
      ['//                            --b "2008-07-04 15:41" --b-date 2008-07-04 --b-sex 女 [--baseline 4000]', '//                            --b "1992-08-20 12:00" --b-date 1992-08-20 --b-sex 女 [--baseline 4000]'],
      ["const A = arg('a', '2007-12-25 16:26'), B = arg('b', '2008-07-04 15:41');", "const A = arg('a', '1990-03-15 12:00'), B = arg('b', '1992-08-20 12:00');"],
      ["const aDate = arg('a-date', '2007-12-25'), bDate = arg('b-date', '2008-07-04');", "const aDate = arg('a-date', '1990-03-15'), bDate = arg('b-date', '1992-08-20');"],
    ],
  },
];

for (const { file, pairs } of PATCHES) {
  if (!fs.existsSync(file)) { console.log('跳过（不存在）: ' + file); continue; }
  let s = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    if (s.includes(from)) { s = s.split(from).join(to); n++; }
    else console.log('未命中: ' + file + ' ← ' + from.slice(0, 40));
  }
  fs.writeFileSync(file, s, 'utf8');
  console.log(`${file}: 替换 ${n}/${pairs.length} 处`);
}
