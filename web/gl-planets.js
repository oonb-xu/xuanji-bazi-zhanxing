// WebGL 纹理球体：用真实行星贴图渲染精细模型
// 独立 canvas 层，由 fusion3d.js 每帧调用 drawPlanet() 定位
let gl = null, prog = null, sphere = null, texCache = new Map(), W = 1, H = 1;

const VS = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUV;
uniform mat4 uProj;
uniform mat4 uModel;
uniform vec3 uLight;      // 光源方向（相机空间）
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vView;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vNormal = normalize(mat3(uModel) * aNormal);
  vUV = aUV;
  vView = normalize(-world.xyz);
  gl_Position = uProj * world;
}
`;

const FS = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uLight;
uniform float uUseTex;
uniform vec3 uColor;
uniform float uBright;
varying vec3 vNormal;
varying vec2 vUV;
void main() {
  vec3 N = normalize(vNormal);
  // 太阳光照：来自 uLight 方向
  float diff = max(dot(N, normalize(uLight)), 0.0);
  // 明暗交界柔化 + 环境光
  float lam = 0.16 + 0.95 * diff;
  // 边缘光（rim）
  float rim = pow(1.0 - max(dot(N, vec3(0.0,0.0,1.0)), 0.0), 2.4) * 0.5;

  vec3 base;
  if (uUseTex > 0.5) {
    base = texture2D(uTex, vUV).rgb;
  } else {
    base = uColor;
  }
  vec3 col = base * lam * uBright;
  col += vec3(0.42, 0.68, 1.0) * rim * 0.55;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(g, type, src) {
  const s = g.createShader(type);
  g.shaderSource(s, src); g.compileShader(s);
  if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
  return s;
}

function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
    o[i * 4 + j] = s;
  }
  return o;
}
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(eye, center, up) {
  const z = norm2([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
  const x = norm2(cross2(up, z));
  const y = cross2(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot2(x, eye), -dot2(y, eye), -dot2(z, eye), 1,
  ]);
}
const cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm2(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/** 生成球体网格（经纬细分） */
function makeSphere(g, seg = 36, rings = 24) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let r = 0; r <= rings; r++) {
    const v = r / rings, phi = v * Math.PI;
    for (let s = 0; s <= seg; s++) {
      const u = s / seg, theta = u * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      pos.push(x, y, z); nor.push(x, y, z); uv.push(u, v);
    }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s, b = a + seg + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const buf = (data, type) => { const b = g.createBuffer(); g.bindBuffer(type, b); g.bufferData(type, data, g.STATIC_DRAW); return b; };
  return {
    pos: buf(new Float32Array(pos), g.ARRAY_BUFFER),
    nor: buf(new Float32Array(nor), g.ARRAY_BUFFER),
    uv: buf(new Float32Array(uv), g.ARRAY_BUFFER),
    idx: buf(new Uint16Array(idx), g.ELEMENT_ARRAY_BUFFER),
    count: idx.length,
  };
}

/** 初始化 WebGL（失败返回 false） */
export function initGL(canvas) {
  const g = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true })
    || canvas.getContext('experimental-webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });
  if (!g) return false;
  gl = g;
  try {
    prog = g.createProgram();
    g.attachShader(prog, compile(g, g.VERTEX_SHADER, VS));
    g.attachShader(prog, compile(g, g.FRAGMENT_SHADER, FS));
    g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog));
    g.useProgram(prog);
    sphere = makeSphere(g);
    prog.aPos = g.getAttribLocation(prog, 'aPos');
    prog.aNormal = g.getAttribLocation(prog, 'aNormal');
    prog.aUV = g.getAttribLocation(prog, 'aUV');
    prog.uProj = g.getUniformLocation(prog, 'uProj');
    prog.uModel = g.getUniformLocation(prog, 'uModel');
    prog.uLight = g.getUniformLocation(prog, 'uLight');
    prog.uTex = g.getUniformLocation(prog, 'uTex');
    prog.uUseTex = g.getUniformLocation(prog, 'uUseTex');
    prog.uColor = g.getUniformLocation(prog, 'uColor');
    prog.uBright = g.getUniformLocation(prog, 'uBright');
    g.enable(g.DEPTH_TEST);
    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
    g.clearColor(0, 0, 0, 0);
    return true;
  } catch (e) { console.error('WebGL init failed', e); return false; }
}

export function resizeGL(canvas, w, h) {
  if (!gl) return;
  // ★ 尺寸没变就不动（改 canvas.width 会清空 WebGL 缓冲）
  if (canvas.width === w && canvas.height === h && W === w && H === h) return;
  canvas.width = w; canvas.height = h;
  gl.viewport(0, 0, w, h); W = w; H = h;
}

export function clearGL() {
  if (!gl) return;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

/** 载入纹理（返回 Promise；同名只载一次） */
export function loadTexture(url) {
  if (!gl) return Promise.resolve(null);
  if (texCache.has(url)) return Promise.resolve(texCache.get(url));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      texCache.set(url, t);
      resolve(t);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

let _proj = null, _view = null;
/** 设置相机（每帧一次） */
export function setCamera(cam, aspect) {
  if (!gl) return;
  _proj = perspective(cam.fov, aspect, 0.01, 100);
  const e = [0, 0, cam.dist];
  _view = lookAt(e, [0, 0, 0], [0, 1, 0]);
  gl.viewport(0, 0, W, H);
}

/**
 * 画一颗纹理球
 * @param p {x,y,z} 屏幕像素位置（已由 2D 相机算好）
 * @param r 屏幕半径（像素）
 * @param tex 纹理对象或 null
 * @param color 无纹理时的颜色
 * @param spin 自转角度（弧度）
 * @param light 光照方向（屏幕空间，弧度）
 */
export function drawPlanet(p, r, tex, color, spin, light, bright = 1) {
  if (!gl || !prog) return;
  // 用正交投影把球放到屏幕对应像素位置
  const x = (p.x / W) * 2 - 1;
  const y = 1 - (p.y / H) * 2;
  const sx = (r / W) * 2, sy = (r / H) * 2;

  const proj = new Float32Array([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, 1, 0, x, y, 0, 1]);
  // 模型矩阵：绕 Y 自转
  const c = Math.cos(spin), s = Math.sin(spin);
  const model = new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);

  gl.useProgram(prog);
  gl.uniformMatrix4fv(prog.uProj, false, proj);
  gl.uniformMatrix4fv(prog.uModel, false, model);
  gl.uniform3f(prog.uLight, Math.cos(light), -Math.sin(light), 0.55);
  gl.uniform1f(prog.uBright, bright);

  if (tex) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.uTex, 0);
    gl.uniform1f(prog.uUseTex, 1);
  } else {
    gl.uniform1f(prog.uUseTex, 0);
    gl.uniform3f(prog.uColor, color[0], color[1], color[2]);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, sphere.pos);
  gl.enableVertexAttribArray(prog.aPos);
  gl.vertexAttribPointer(prog.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, sphere.nor);
  gl.enableVertexAttribArray(prog.aNormal);
  gl.vertexAttribPointer(prog.aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, sphere.uv);
  gl.enableVertexAttribArray(prog.aUV);
  gl.vertexAttribPointer(prog.aUV, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.idx);
  gl.drawElements(gl.TRIANGLES, sphere.count, gl.UNSIGNED_SHORT, 0);
}
