// 免责声明（三处）+ 爱发电（FUNDING.yml / README / 关于页）
import fs from 'node:fs';

const AFDIAN = 'https://afdian.com/@YOUR_ID';   // ← 把 YOUR_ID 换成你的爱发电主页 ID
const AFDIAN_NOTE = '（把 YOUR_ID 换成你的爱发电 ID）';

/* ═══ ① README：重写免责声明 + 加「支持」节 ═══ */
{
  const P = 'README.md';
  let r = fs.readFileSync(P, 'utf8');
  const i = r.indexOf('## 免责声明');
  if (i < 0) { console.error('❌ README 找不到「免责声明」'); process.exit(1); }
  const before = r.slice(0, i);
  const NEW = `## 免责声明（请务必阅读）

> **本项目仅仅是兴趣爱好的开放讨论，不是产品，也不是服务。**

### 1. 定位

- 这是一份**个人兴趣驱动的开源研究与技术实验**，用于探索命理体系的结构与编码方式。
- 所有内容（代码、算法、文档、盘面、解读、示例）**仅供学习、讨论与学术研究**。
- 本项目**不是**医疗、心理、法律、财务、投资、婚恋或职业规划工具。

### 2. 输出结果不构成任何建议

- 模型输出**可能与现实完全不符**。命理体系的有效性在科学上**尚无定论**。
- 任何输出**都不构成**诊断、预测、决策依据或行动建议。
- 请勿依据本项目的输出做出任何影响自己或他人生活的决定。

### 3. 责任划分

- **因使用本项目的输出结果而在现实生活中造成的任何问题、损失、纠纷或后果，与开发者无关。**
- 包括但不限于：据此做出的婚恋/职业/投资/医疗决策、人际冲突、心理困扰、经济损失。
- 使用者**自行承担全部风险与责任**。

### 4. 无担保

- 本项目按 **"现状"（AS IS）** 提供，**不提供任何明示或暗示的担保**，
  包括但不限于适销性、特定用途适用性、准确性与不侵权担保。
- 天文数据来自第三方星历库，其正确性不由本项目担保。

### 5. 禁止用途

严禁将本项目用于：
- 医疗诊断、治疗建议或替代专业医疗意见
- 赌博、彩票、金融投机决策
- 欺诈、恐吓、精神控制、传销
- 对他人进行未经同意的命理评估或人格评判
- 任何违反当地法律法规的用途

### 6. 数据与隐私

- 本项目**不收集身份信息**，也**绝不接收 API Key**。详见 [PRIVACY.md](PRIVACY.md)。
- 你输入的出生信息只在你的设备与本机服务间流转。
- 若你部署到公网，请自行承担合规责任。

### 7. 未成年人

本项目不面向 14 岁以下儿童。未成年人使用需监护人知情同意。

### 8. 效力

**下载、克隆、运行、分发或以任何方式使用本项目，即视为你已阅读、理解并同意上述全部条款。**
若不同意，请立即停止使用并删除本项目。

---

## 支持这个项目

如果这个项目对你有帮助，或者你希望它继续做下去，可以通过爱发电支持：

**[→ 爱发电]( ${AFDIAN} )** ${AFDIAN_NOTE}

> 赞助**不附带任何承诺**：不换取付费咨询、不换取"更准的命理结果"、不换取功能优先级。
> 它只是对这个兴趣项目的一点鼓励。**请务必量力而行，不要为此影响正常生活。**
>
> 若你不方便赞助，**给个 Star、提个 Issue、指出一个文献错误，同样是实质性的帮助。**

---

## 致谢

- 星历：astronomy-engine · kerykeion · VedAstro · skyfield
- 命理参考：tyme4ts · liuren-ts-lib · iztro
- 所有指出错误、贡献匿名样本、参与讨论的人

**最后再说一次：这是兴趣，不是命运指南。玩得开心，别当真。**
`;
  fs.writeFileSync(P, before + NEW, 'utf8');
  console.log('✅ README 免责声明已重写 + 支持/致谢节已加');
}

/* ═══ ② .github/FUNDING.yml（GitHub 标准赞助入口）═══ */
{
  const dir = '.github';
  fs.mkdirSync(dir, { recursive: true });
  const C = `# GitHub 赞助入口（显示在仓库右上角 "Sponsor" 按钮）
# 爱发电属于「自定义链接」，填在 custom 下

custom: ['${AFDIAN}']

# 如有 GitHub Sponsors，取消注释：
# github: [your-github-username]

# 说明：赞助不附带任何承诺（不换付费咨询、不换功能优先级）
`;
  fs.writeFileSync('.github/FUNDING.yml', C, 'utf8');
  console.log('✅ .github/FUNDING.yml 已生成（爱发电入口）');
}

/* ═══ ③ 视频：末幕加免责，并把时长拉长 ═══ */
{
  const P = 'web/video-intro.html';
  let v = fs.readFileSync(P, 'utf8');
  if (v.includes('兴趣爱好的开放讨论')) { console.log('— 视频已有免责'); }
  else {
    /* 找到最后一幕（收束）的结束 */
    const lastScene = v.lastIndexOf('<section class="scene"');
    const secEnd = v.indexOf('</section>', lastScene);
    if (lastScene < 0 || secEnd < 0) { console.error('❌ 视频末幕定位失败'); process.exit(1); }

    /* 在末幕结尾插入免责块 */
    const DISC = `
    <div class="q" style="margin-top:26px;border-left-color:var(--red);background:rgba(255,154,138,.07);font-size:17px;line-height:1.85">
      <b class="red">免责声明</b>：本项目<b>仅仅是兴趣爱好的开放讨论</b>，不是产品也不是服务。<br>
      输出结果可能与现实完全不符，<b>不构成任何诊断、预测或决策建议</b>。<br>
      <b>因使用本项目输出结果而在现实生活中造成的任何问题、损失或后果，与开发者无关</b>，责任由使用者自行承担。<br>
      <span class="mut" style="font-size:14.5px">本项目按"现状"提供，不作任何担保；严禁用于医疗、赌博、欺诈或对他人未经同意的命理评估。</span>
    </div>
    <p class="mut" style="margin-top:16px;font-size:15px">
      如果它对你有一点点帮助 ——
      <a href="${AFDIAN}" target="_blank" rel="noopener" style="color:var(--gold)">爱发电</a>
      支持一下（不附带任何承诺，请量力而行）。
    </p>
`;
    v = v.slice(0, secEnd) + DISC + v.slice(secEnd);

    /* 末幕时长拉长到 13 秒，给免责留阅读时间 */
    const seg = v.slice(lastScene, v.indexOf('>', lastScene) + 1);
    if (seg.includes('data-dur=')) {
      v = v.slice(0, lastScene) + seg.replace(/data-dur="\d+"/, 'data-dur="13000"') + v.slice(v.indexOf('>', lastScene) + 1);
    }
    fs.writeFileSync(P, v, 'utf8');
    const n = (v.match(/class="scene/g) || []).length;
    const total = [...v.matchAll(/data-dur="(\d+)"/g)].reduce((a, m) => a + Number(m[1]), 0) / 1000;
    console.log('✅ 视频末幕已加免责 + 爱发电（' + n + ' 幕 / ' + total + ' 秒）');
  }
}

/* ═══ ④ 关于页：免责卡（许可卡之后）═══ */
{
  const P = 'web/index.html';
  let h = fs.readFileSync(P, 'utf8');
  if (h.includes('id="sec-disclaimer"')) { console.log('— 关于页已有免责卡'); }
  else {
    const CARD = `
      <div class="card" id="sec-disclaimer">
        <h2>免责声明 <span class="sub">请务必阅读</span></h2>
        <p class="note" style="margin:0 0 12px;font-size:14.5px;color:#ff9a8a">
          <b>本项目仅仅是兴趣爱好的开放讨论，不是产品，也不是服务。</b>
        </p>
        <table class="holo-tb">
          <thead><tr><th style="width:18%">条目</th><th>内容</th></tr></thead>
          <tbody>
            <tr><td class="pn">定位</td><td class="mut">个人兴趣驱动的<b>开源研究与技术实验</b>，仅供学习、讨论与学术研究；<b>不是</b>医疗/心理/法律/财务/婚恋/职业工具</td></tr>
            <tr><td class="pn">输出</td><td class="mut">模型输出<b>可能与现实完全不符</b>；命理体系的有效性在科学上尚无定论；<b>不构成任何诊断、预测或行动建议</b></td></tr>
            <tr><td class="pn">责任</td><td class="mut"><b style="color:#ff9a8a">因使用本项目输出结果而在现实生活中造成的任何问题、损失、纠纷或后果，与开发者无关</b>；使用者自行承担全部风险</td></tr>
            <tr><td class="pn">担保</td><td class="mut">按「现状（AS IS）」提供，<b>不作任何明示或暗示担保</b>；第三方星历数据的正确性不由本项目担保</td></tr>
            <tr><td class="pn">禁止</td><td class="mut">医疗诊断 · 赌博投机 · 欺诈 · 对他人未经同意的命理评估 · 任何违法用途</td></tr>
            <tr><td class="pn">隐私</td><td class="mut">不收集身份信息，<b>绝不接收 API Key</b>；出生信息只在你的设备与本机服务间流转</td></tr>
            <tr><td class="pn">未成年人</td><td class="mut">不面向 14 岁以下儿童；未成年人使用需监护人知情同意</td></tr>
            <tr><td class="pn">效力</td><td class="mut"><b>下载、运行、分发或以任何方式使用本项目，即视为已阅读并同意上述全部条款。</b></td></tr>
          </tbody>
        </table>

        <div style="margin-top:16px;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,196,87,.28);background:rgba(255,196,87,.05)">
          <div style="font-size:13.5px;font-weight:700;color:#ffd58a;margin-bottom:6px">支持这个项目</div>
          <div class="note" style="margin:0;font-size:12.5px;line-height:1.9">
            如果它对你有一点点帮助，可以通过
            <a href="${AFDIAN}" target="_blank" rel="noopener" style="color:#ffc457;font-weight:700">爱发电</a>
            支持一下。<br>
            <b>赞助不附带任何承诺</b>：不换付费咨询、不换"更准的结果"、不换功能优先级 ——
            请<b>量力而行</b>，别为此影响正常生活。<br>
            不方便赞助的话，<b>给个 Star、提个 Issue、指出一处文献错误，同样是实质性的帮助</b>。
          </div>
        </div>
      </div>
`;
    /* 插到 sec-license 卡片之后 */
    const li = h.indexOf('id="sec-license"');
    if (li < 0) { console.error('❌ 找不到 sec-license'); process.exit(1); }
    const cardStart = h.lastIndexOf('<div class="card"', li);
    const re = /<div\b|<\/div>/g; re.lastIndex = cardStart;
    let d = 0, m, end = -1;
    while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { end = m.index + 6; break; } }
    h = h.slice(0, end) + '\n\n      ' + CARD.trim() + h.slice(end);
    console.log('✅ 关于页已加免责卡（许可卡之后）');
  }

  /* 导航：加第 14 项 */
  if (!h.includes('href="#sec-disclaimer"')) {
    const OLD = '<a href="#sec-license" class="toc-i"><b>13</b><span>开源许可</span><i>Apache-2.0</i></a>';
    if (h.includes(OLD)) {
      h = h.replace(OLD, OLD + '<a href="#sec-disclaimer" class="toc-i warn"><b>14</b><span>免责声明</span><i>请务必阅读</i></a>');
      console.log('✅ 导航已加第 14 项「免责声明」');
    } else console.log('⚠️ 导航第 13 项未匹配');
  }

  fs.writeFileSync(P, h, 'utf8');

  /* 校验 */
  const c = (s, re2) => (s.match(re2) || []).length;
  let bad = 0;
  for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
    ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g], ['td', /<td\b/g, /<\/td>/g],
    ['th', /<th\b/g, /<\/th>/g], ['p', /<p\b/g, /<\/p>/g], ['a', /<a\b/g, /<\/a>/g]]) {
    const ok = c(h, o) === c(h, cl);
    if (!ok) { bad++; console.log('  ❌ ' + n + ' ' + c(h, o) + '/' + c(h, cl)); }
  }
  const app = h.indexOf('<div id="app"');
  const at = h.indexOf('>', app) + 1;
  const r3 = /<div\b|<\/div>/g; r3.lastIndex = at;
  let d3 = 1, m3, appEnd = -1;
  while ((m3 = r3.exec(h))) { d3 += m3[0] === '</div>' ? -1 : 1; if (d3 === 0) { appEnd = m3.index; break; } }
  const inApp = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline', 'about'].every((k) => {
    const p = h.indexOf('data-page="' + k + '"'); return p > app && p < appEnd;
  });
  if (!inApp) { bad++; console.log('  ❌ #app 未包住全部页面'); }
  console.log((bad ? '❌ ' : '✅ ') + '标签平衡 · #app 完整 · ' + h.length + ' 字节');
}
