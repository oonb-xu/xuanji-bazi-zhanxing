// 测质量分级（不拒收，只分档）
import { qualityAssess } from '../src/app/collect-endpoints.mjs';

const P = ['戊子', '戊午', '乙巳', '甲申'];
const cases = [
  ['全无', { pillars: P }],
  ['未矫正', { pillars: P, rectifyEvents: [{ year: 2010 }, { year: 2015 }, { year: 2019 }], outcomeEvents: [{ year: 2020, category: '婚姻' }] }],
  ['已矫正无结局', { pillars: P, rectified: true, rectifyEvents: [{ year: 2010 }, { year: 2015 }, { year: 2019 }], outcomeEvents: [{ year: 2020, category: '其它' }] }],
  ['已矫正单事件', { pillars: P, rectified: true, rectifyEvents: [{ year: 2010 }, { year: 2015 }, { year: 2019 }], outcomeEvents: [{ year: 2020, category: '婚姻' }] }],
  ['已矫正多事件', { pillars: P, rectified: true, rectifyEvents: [{ year: 2010 }, { year: 2015 }, { year: 2019 }], outcomeEvents: [{ year: 2020, category: '婚姻' }, { year: 2022, category: '事业' }] }],
  ['缺四柱', { rectified: true, rectifyEvents: [{ year: 2010 }], outcomeEvents: [{ year: 2020, category: '婚姻' }] }],
];

console.log('=== 质量分级（照收，只标等级） ===');
for (const [n, p] of cases) {
  const q = qualityAssess(p);
  console.log(`${n.padEnd(10)} 级${q.tier}  权重${q.weight}  分${String(q.score).padStart(3)}  ${q.label}`);
}

const a = qualityAssess(cases[4][1]);
console.log('');
console.log('A 级是否也带提示条数:', a.advisories.length);
console.log('A 级 impact:', a.impact);
const b = qualityAssess(cases[1][1]);
console.log('');
console.log('未矫正的误差告知:');
for (const s of b.advisories) console.log('  · ' + s.slice(0, 72) + (s.length > 72 ? '…' : ''));
console.log('');
console.log('未矫正 impact:', b.impact);
