// 59.58 问题的定量计算：微分漂移 / 超辰 / 物候滞后 / 触发窗口
const D2R = Math.PI / 180;
const out = {};

/* ── 一、木土 60 周期的微分漂移 ── */
const T_JUP = 11.862;                 // 木星恒星周期（年）
const T_SAT = 29.457;                 // 土星恒星周期（年）
const SYN = 1 / (1 / T_JUP - 1 / T_SAT);   // 木土会合周期
const T60 = 60;                       // 日历的「60 年」
const three = 3 * SYN;                // 3 次会合

out.木星周期 = T_JUP;
out.土星周期 = T_SAT;
out.木土会合周期 = +SYN.toFixed(6);
out.三次会合 = +three.toFixed(6);
out.与60的差 = +(T60 - three).toFixed(6);

/* 每年累计的「周期差」（单位：次/年） */
const k = 1 / three - 1 / T60;        // 天文速率 − 日历速率（周期/年）
out.速率差_周期每年 = +k.toExponential(6);
out.每60年漂移_年 = +(k * 60 * three).toFixed(6);
out.每60年漂移_天 = +(k * 60 * three * 365.2422).toFixed(2);
out.相对速率_百分比 = +(k * three * 100).toFixed(4);

/* 漂移累计到某量所需年数 */
const driftPerYear_years = k * three;   // 每年累计的「年」数
out.每年累计_年 = +driftPerYear_years.toFixed(6);
out.累计1个月需年数 = +(30.4375 / 365.2422 / driftPerYear_years).toFixed(1);
out.累计半年需年数 = +(0.5 / driftPerYear_years).toFixed(1);
out.累计1年需年数 = +(1 / driftPerYear_years).toFixed(1);
out.累计2年需年数 = +(2 / driftPerYear_years).toFixed(1);
out.累计10年需年数 = +(10 / driftPerYear_years).toFixed(0);
out.累计整60年周期需年数 = +(60 / driftPerYear_years).toFixed(0);

/* 从一个历元外推到现在：以汉太初历元（前104）为锚 */
const now = 2025;
const tFromTaiChu = now - (-104);
out.太初至今年数 = tFromTaiChu;
out.太初外推累计偏移_年 = +(tFromTaiChu * driftPerYear_years).toFixed(2);
out.太初外推年柱错位数 = Math.round(tFromTaiChu * driftPerYear_years);
/* 以 1984 甲子为锚 */
const tFrom1984 = now - 1984;
out['1984至今偏移_天'] = +(tFrom1984 * driftPerYear_years * 365.2422).toFixed(1);

/* ── 二、岁星超辰 ── */
const jupRate = 12 / T_JUP;            // 实际每年走过的「次」数
out.岁星实际速率_次每年 = +jupRate.toFixed(6);
out.超一辰_现代算_年 = +(1 / (jupRate - 1)).toFixed(1);
/* 古法：144 年超一辰 ⇒ 反推古人用的岁星周期 */
const periodSanTong = 12 / (1 + 1 / 144);
out.三统历隐含岁星周期_年 = +periodSanTong.toFixed(4);
out.三统历超辰间隔_年 = 144;
out.大周_年 = 144 * 12;

/* ── 三、6 甲子日 vs 回归年 ── */
const trop = 365.2422, sixJiazi = 6 * 60;
out.六甲子日 = sixJiazi;
out.回归年 = trop;
out.每年亏欠_天 = +(trop - sixJiazi).toFixed(4);
out.咬合率_百分比 = +((sixJiazi / trop) * 100).toFixed(2);
out.亏满1个甲子日周期需年 = +(60 / (trop - sixJiazi)).toFixed(1);
out.亏满1个月需年 = +(30.4375 / (trop - sixJiazi)).toFixed(1);

/* ── 四、物候热滞后 ── */
/* 冬至 12/21 → 大寒 1/20；夏至 6/21 → 大暑 7/22 */
out.冷极滞后_天 = (new Date(2024, 0, 20) - new Date(2023, 11, 21)) / 86400000;
out.热极滞后_天 = (new Date(2024, 6, 22) - new Date(2024, 5, 21)) / 86400000;
out.一个中气间隔_天 = +(trop / 12).toFixed(2);
out.热滞后_合月建数 = +(out.热极滞后_天 / out.一个中气间隔_天).toFixed(2);

/* ── 五、月建与热季的错位（逐月） ── */
const JIE = [
  ['寅', '立春 02-04', '冬季末', '仍在严寒/回暖初期'],
  ['卯', '惊蛰 03-06', '早春', '真正回暖'],
  ['辰', '清明 04-05', '春', '暖而湿'],
  ['巳', '立夏 05-06', '春夏之交', '实际仍偏春'],
  ['午', '芒种 06-06', '夏季', '实际初夏'],
  ['未', '小暑 07-07', '盛夏', '热极在此'],
  ['申', '立秋 08-08', '秋初', '实际仍热'],
  ['酉', '白露 09-08', '秋', '转凉'],
  ['戌', '寒露 10-08', '深秋', '干凉'],
  ['亥', '立冬 11-07', '冬初', '凉而不寒'],
  ['子', '大雪 12-07', '冬', '寒但未极'],
  ['丑', '小寒 01-06', '隆冬', '冷极在此'],
];
out.月建热季错位表 = JIE.map(([zhi, jie, label, actual]) => ({ 月建: zhi, 节气起: jie, 名义: label, 实际: actual }));

console.log(JSON.stringify(out, null, 2));
