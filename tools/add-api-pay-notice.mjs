// 在 API 位置注明：充值不是给开发者，而是给 AI 模型公司（服务商）
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const MARK = 'api-pay-notice';
if (h.includes(MARK)) { console.log('已存在'); process.exit(0); }

const NOTICE = `<div class="note" id="${MARK}" style="font-size:13px;line-height:2;padding:13px 16px;margin:14px 0;
        border-radius:10px;background:rgba(125,255,180,.06);border:1px solid rgba(125,255,180,.32)">
        <b style="color:#7dffb4;font-size:14px">⚠️ 充值不是给开发者充，而是给 AI 模型公司充。</b><br>
        API Key 是你和<b>服务商</b>之间的账户关系。充进去的钱进的是
        <b>DeepSeek / OpenAI / Anthropic / 阿里云</b> 等<b>模型公司的账户</b>——
        <b>本站开发者一分钱收不到</b>，也不经手、不代收、不抽成。<br>
        · 本站是<b>纯前端＋本地服务</b>，不碰你的 Key，也不碰你的余额；<br>
        · 你填的 Key 只存在你本机浏览器里，本站服务器<b>不保存</b>；<br>
        · 想省钱可以先用<b>各家的免费额度</b>试，觉得有用再充。<br>
        <span style="color:rgba(160,200,225,.8)">换句话说：<b>买的是模型公司的算力</b>，不是给这个项目的赞助。</span>
      </div>
      `;

/* 插在「Key 怎么用（安全提醒）」标题之前 */
const anchor = '<h2>Key 怎么用（安全提醒）</h2>';
if (h.includes(anchor)) {
  h = h.replace(anchor, NOTICE + anchor);
  console.log('✅ 已插入到「Key 怎么用」之前');
} else {
  /* 退路：插在 sec-howto 标题之后 */
  const alt = /(<h2 id="sec-howto"[^>]*>[\s\S]*?<\/h2>)/;
  if (alt.test(h)) {
    h = h.replace(alt, '$1\n      ' + NOTICE);
    console.log('✅ 已插入到 sec-howto 标题之后（退路）');
  } else {
    console.error('❌ 未找到 API 锚点');
    process.exit(1);
  }
}

/* 安全闸 */
const cnt = (s, re) => (s.match(re) || []).length;
const d = [cnt(h, /<div\b/g), cnt(h, /<\/div>/g)];
if (d[0] !== d[1]) { console.error(`❌ div 不平衡 ${d[0]}/${d[1]}，拒绝写盘`); process.exit(1); }

fs.writeFileSync(P, h, 'utf8');
console.log('✅ 已写入（div ' + d[0] + '/' + d[1] + ' 平衡）');
