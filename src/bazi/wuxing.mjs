// 五行工具（八字/占星共用）
export const WU_XING_LIST = ['木', '火', '土', '金', '水'];

export const WU_XING = {
  LIST: WU_XING_LIST,
  zero: () => Object.fromEntries(WU_XING_LIST.map((w) => [w, 0])),
  round: (o, d = 2) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 10 ** d) / 10 ** d])),
  strongest: (o) => WU_XING_LIST.reduce((a, b) => (o[b] > o[a] ? b : a), WU_XING_LIST[0]),
  weakest: (o) => WU_XING_LIST.reduce((a, b) => (o[b] < o[a] ? b : a), WU_XING_LIST[0]),
};
