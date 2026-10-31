// ① 重写「关于」页：用大白话 + 术语即时解释
// ② 新增 web/cities.js：城市 → 经纬度，供三处表单自动填充
// ③ index.html 加城市下拉；app.js 加绑定
import fs from 'node:fs';

/* ══════════ ② 城市数据 ══════════ */
const CITIES = [
  ['北京', 116.407, 39.904], ['上海', 121.474, 31.230], ['广州', 113.264, 23.129],
  ['深圳', 114.057, 22.543], ['天津', 117.201, 39.084], ['重庆', 106.551, 29.563],
  ['成都', 104.066, 30.572], ['杭州', 120.155, 30.274], ['南京', 118.797, 32.060],
  ['武汉', 114.305, 30.593], ['西安', 108.940, 34.341], ['沈阳', 123.429, 41.796],
  ['哈尔滨', 126.535, 45.803], ['长春', 125.324, 43.887], ['济南', 117.000, 36.651],
  ['郑州', 113.625, 34.746], ['长沙', 112.939, 28.228], ['南昌', 115.858, 28.682],
  ['合肥', 117.283, 31.861], ['福州', 119.296, 26.074], ['厦门', 118.089, 24.479],
  ['昆明', 102.833, 24.880], ['贵阳', 106.630, 26.647], ['南宁', 108.366, 22.817],
  ['海口', 110.199, 20.044], ['兰州', 103.834, 36.061], ['西宁', 101.778, 36.617],
  ['银川', 106.278, 38.467], ['乌鲁木齐', 87.617, 43.792], ['呼和浩特', 111.751, 40.841],
  ['拉萨', 91.140, 29.645], ['石家庄', 114.502, 38.045], ['太原', 112.549, 37.857],
  ['苏州', 120.585, 31.299], ['无锡', 120.312, 31.491], ['宁波', 121.550, 29.875],
  ['温州', 120.699, 27.994], ['青岛', 120.383, 36.067], ['大连', 121.615, 38.914],
  ['东莞', 113.746, 23.047], ['佛山', 113.122, 23.028], ['汕头', 116.708, 23.371],
  ['惠州', 114.416, 23.112], ['珠海', 113.577, 22.271], ['中山', 113.392, 22.517],
  ['香港', 114.174, 22.320], ['澳门', 113.549, 22.199], ['台北', 121.565, 25.033],
];

const citiesJs = `// 城市 → 经纬度（用于自动换算真太阳时）
// 精度到小数点后 3 位（≈100 米级），对真太阳时的贡献远小于 1 分钟，足够。
export const CITIES = ${JSON.stringify(CITIES)};
export const findCity = (name) => CITIES.find((c) => c[0] === name) || null;
`;
fs.writeFileSync('web/cities.js', citiesJs, 'utf8');
console.log('web/cities.js: ' + CITIES.length + ' 个城市');

/* ══════════ ① 新 About 页 ══════════ */
const NEW_ABOUT = `    <!-- ④ 关于 -->
    <section class="page" data-page="about">
      <h2 class="page-title">关于 <span class="sub">它算什么 · 别拿它算什么</span></h2>
      <div class="card prose">
        <h3>一句话</h3>
        <p>你把出生时间地点填进去，它用三种老办法各算一遍，把结果<strong>并排摊给你看</strong>。它不替你下结论——下结论的是你。</p>

        <h3>三种办法分别是什么（用白话说）</h3>
        <ul>
          <li><strong>八字</strong>：把出生年月日时各换成两个字，一共八个字（所以叫"八字"）。老规矩认为这八个字之间的"配合"能看出一个人的底子。</li>
          <li><strong>星盘</strong>：算出你出生那一刻，太阳、月亮和其他几颗星各在天空的什么位置，画成一个圆盘。</li>
          <li><strong>六壬</strong>：这不是算人的，是<strong>算事</strong>的——你心里有件想问的事，把它起念的那个时刻填进去，它按老规矩推演三步给你看（这三步叫"三传"）。</li>
        </ul>

        <h3>★ 最容易出错的地方：出生时间</h3>
        <p>你填的是<strong>手机/钟表上的时间</strong>。但老办法要用的是<strong>"当地太阳真正在头顶的时间"</strong>——这两者在中国能差<strong>一个多小时</strong>（因为全国统一用北京时间，可太阳并不是按北京的时间升落的）。</p>
        <p>本工具会自动帮你换。换完如果"时柱"（八个字里的最后两个字）变了，会<strong>红字提醒你</strong>。</p>
        <p>还有两种情况，差<strong>几分钟</strong>结果就完全不同：</p>
        <ul>
          <li><strong>出生时间正好卡在两个时辰之间</strong>（比如 16:58 前后）——差 5 分钟，最后两个字就换成别的，整张盘一半都变了。</li>
          <li><strong>出生时间正好卡在两个星座的交界</strong>——差 3 分钟，"上升星座"就换一个，所有跟上升有关的说法<strong>全部作废</strong>。</li>
        </ul>
        <p>所以：<strong>出生时间记不准的，请先去"矫正"页</strong>。你只要提供几件有确切年月的人生大事（结婚、生孩子、大病、换工作、搬家），它就能反推出更可能的时间。</p>

        <h3>哪些可以信，哪些别信</h3>
        <p><strong>可以信的：算得准不准。</strong>八个字、行星度数、宫位、三传——这些都是按固定规则算出来的，换谁算都一样，错了也能复查。这部分本工具做过大规模核对。</p>
        <p><strong>不能全信的：算得灵不灵。</strong></p>
        <ul>
          <li>合盘那个分数，衡量的是<strong>"两张盘的结构像不像、互相补不补"</strong>。它衡量的是<strong>结构</strong>，不是"你俩能不能过一辈子"。它<strong>没有用任何真实情侣的结局校准过</strong>。</li>
          <li>两个人怎么相处、愿不愿意让步、遇事怎么选——<strong>这些东西盘里没有</strong>，工具也不假装能算。</li>
          <li>八字讲"木火土金水"，星盘讲"火土风水"，<strong>是两套完全不同的说法</strong>，所以只并排给你看，不硬凑成一个数。</li>
        </ul>

        <h3>你的数据去哪了</h3>
        <p>算的时候<strong>全在你自己电脑上</strong>，你填的生日地点<strong>不会发给任何服务器</strong>，关掉页面就没了。<br>
        只有你在「反馈」页<strong>主动点提交</strong>时，才会发一次<strong>匿名</strong>数据（只含八个字、性别、出生地、事件年份，<strong>不含姓名和任何联系方式</strong>），用于让模型以后更准。</p>

        <h3>最后</h3>
        <p>它是一台<strong>把老规矩拆开给你看</strong>的机器，不是算命先生。它给的每个数字你都可以不信——但至少你能看见它是<strong>怎么算出来的</strong>。</p>
      </div>
    </section>`;

let html = fs.readFileSync('web/index.html', 'utf8');
const s = html.indexOf('    <!-- ④ 关于 -->');
const e = html.indexOf('  </main>', s);
if (s < 0 || e < 0) { console.log('未找到关于页区间'); process.exit(1); }
html = html.slice(0, s) + NEW_ABOUT + '\n' + html.slice(e);
console.log('关于页已重写（大白话 + 术语解释）');

/* ══════════ ③ 加城市下拉 ══════════ */
const cityOptions = ['<option value="">选择城市自动填经纬度…</option>']
  .concat(CITIES.map(([n, lng, lat]) => `<option value="${n}" data-lng="${lng}" data-lat="${lat}">${n}</option>`))
  .join('\n            ');

// 三处表单：在"经度"label 前插入城市下拉
let injected = 0;
html = html.replace(/(<label>经度<input type="number" name="(lng|a_lng|b_lng)")/g, (m, p1, name) => {
  const id = name === 'lng' ? 'city-fusion' : name === 'a_lng' ? 'city-a' : 'city-b';
  injected++;
  return `<label>城市<select id="${id}" class="city-pick">\n            ${cityOptions}\n          </select></label>\n        ${p1}`;
});
console.log('城市下拉注入: ' + injected + ' 处');

// 引入 cities.js（在 app.js 之前）
if (!html.includes('/cities.js')) {
  html = html.replace('<script src="/app.js"></script>', '<script type="module" src="/app.js"></script>');
  console.log('app.js 改为 module（因为要 import cities.js）');
}
fs.writeFileSync('web/index.html', html, 'utf8');

/* ══════════ ④ app.js 绑定 ══════════ */
let js = fs.readFileSync('web/app.js', 'utf8');
if (!js.includes('CITY_BINDING')) {
  const binding = `
/* ══════════ 城市 → 经纬度 自动填充（CITY_BINDING） ══════════ */
import { findCity } from '/cities.js';
function bindCitySelects() {
  const pairs = [['#city-fusion', 'input[name="lng"]', 'input[name="lat"]'],
                 ['#city-a', 'input[name="a_lng"]', 'input[name="a_lat"]'],
                 ['#city-b', 'input[name="b_lng"]', 'input[name="b_lat"]']];
  for (const [sel, lngSel, latSel] of pairs) {
    const el = document.querySelector(sel);
    if (!el) continue;
    el.addEventListener('change', () => {
      const c = findCity(el.value);
      if (!c) return;
      const [, lng, lat] = c;
      const li = document.querySelector(lngSel), la = document.querySelector(latSel);
      if (li) li.value = lng;
      if (la) la.value = lat;
    });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindCitySelects);
else bindCitySelects();
`;
  js = js + binding;
  fs.writeFileSync('web/app.js', js, 'utf8');
  console.log('app.js: 已追加城市绑定（CITY_BINDING）');
} else {
  console.log('app.js: 城市绑定已存在');
}
