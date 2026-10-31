import * as A from 'astronomy-engine';

/* 先单独测一次，把真实错误打出来 */
const J = A.Body.Jupiter, S = A.Body.Saturn;
for (const y of [1600, 1700, 1900, 2100, 2300]) {
  try {
    const t = A.SearchRelativeLongitude(J, S, 0, new Date(Date.UTC(y, 0, 1)));
    console.log(y, '✅', t.date.toISOString().slice(0, 10));
  } catch (e) {
    console.log(y, '❌', e.message);
  }
}
/* 也试 AstroTime 包装 */
try {
  const at = A.MakeTime(new Date(Date.UTC(1900, 0, 1)));
  const t2 = A.SearchRelativeLongitude(J, S, 0, at);
  console.log('AstroTime 包装 ✅', t2.date.toISOString().slice(0, 10));
} catch (e) {
  console.log('AstroTime 包装 ❌', e.message);
}
