/* GameDesk — gemeinsamer 3D-Renderer (WebGL2)
 *
 * Es gibt genau EINEN WebGL-Kontext für das ganze Board. Jede 3D-Kachel lässt
 * ihre Szene in diesen versteckten Puffer zeichnen und kopiert das Ergebnis per
 * drawImage in ihr eigenes 2D-Canvas. Dadurch sind beliebig viele 3D-Fenster
 * möglich (Browser erlauben nur ~16 Kontexte) und der Speicher bleibt flach.
 */
(function () {
  'use strict';
  const GD = window.GD;

  /* ====================================================== Matrizen === */

  const M4 = {
    identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },

    multiply(a, b, out) {
      const o = out || new Float32Array(16);
      for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
          o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
      }
      return o;
    },

    perspective(fovY, aspect, near, far) {
      const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0]);
    },

    ortho(l, r, b, t, n, f) {
      return new Float32Array([
        2 / (r - l), 0, 0, 0,
        0, 2 / (t - b), 0, 0,
        0, 0, -2 / (f - n), 0,
        -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
    },

    lookAt(eye, center, up) {
      let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      l = Math.hypot(xx, xy, xz);
      if (l < 1e-6) { xx = 1; xy = 0; xz = 0; } else { xx /= l; xy /= l; xz /= l; }
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return new Float32Array([
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
        -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
        -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
    },

    /** Position, Euler-Rotation (Grad, XYZ) und Skalierung zu einer Matrix */
    compose(p, rDeg, s, out) {
      const m = out || new Float32Array(16);
      const d = Math.PI / 180;
      const cx = Math.cos(rDeg[0] * d), sx = Math.sin(rDeg[0] * d);
      const cy = Math.cos(rDeg[1] * d), sy = Math.sin(rDeg[1] * d);
      const cz = Math.cos(rDeg[2] * d), sz = Math.sin(rDeg[2] * d);
      // R = Ry * Rx * Rz
      const r00 = cy * cz + sy * sx * sz, r01 = -cy * sz + sy * sx * cz, r02 = sy * cx;
      const r10 = cx * sz, r11 = cx * cz, r12 = -sx;
      const r20 = -sy * cz + cy * sx * sz, r21 = sy * sz + cy * sx * cz, r22 = cy * cx;
      m[0] = r00 * s[0]; m[1] = r10 * s[0]; m[2] = r20 * s[0]; m[3] = 0;
      m[4] = r01 * s[1]; m[5] = r11 * s[1]; m[6] = r21 * s[1]; m[7] = 0;
      m[8] = r02 * s[2]; m[9] = r12 * s[2]; m[10] = r22 * s[2]; m[11] = 0;
      m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1;
      return m;
    },

    invert(m, out) {
      const o = out || new Float32Array(16);
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
      const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
      const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null;
      det = 1 / det;
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
      o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
      o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
      o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
      o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
      o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
      o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
      o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
      o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return o;
    },

    normalMatrix(m, out) {
      const inv = M4.invert(m);
      const o = out || new Float32Array(9);
      if (!inv) { o.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); return o; }
      o[0] = inv[0]; o[1] = inv[4]; o[2] = inv[8];
      o[3] = inv[1]; o[4] = inv[5]; o[5] = inv[9];
      o[6] = inv[2]; o[7] = inv[6]; o[8] = inv[10];
      return o;
    },

    point(m, p, out) {
      const o = out || [0, 0, 0];
      const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] || 1;
      o[0] = (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w;
      o[1] = (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w;
      o[2] = (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w;
      return o;
    },

    dir(m, p, out) {
      const o = out || [0, 0, 0];
      o[0] = m[0] * p[0] + m[4] * p[1] + m[8] * p[2];
      o[1] = m[1] * p[0] + m[5] * p[1] + m[9] * p[2];
      o[2] = m[2] * p[0] + m[6] * p[1] + m[10] * p[2];
      return o;
    }
  };

  /* ======================================================== Shader === */

  const VS_MAIN = `#version 300 es
in vec3 a_pos; in vec3 a_nrm; in vec2 a_uv;
uniform mat4 u_vp, u_model; uniform mat3 u_nrmMat;
out vec3 v_world; out vec3 v_nrm; out vec2 v_uv; out vec3 v_obj; out vec3 v_onrm;
void main(){
  vec4 wp = u_model * vec4(a_pos, 1.0);
  v_world = wp.xyz;
  v_nrm = u_nrmMat * a_nrm;
  v_uv = a_uv;
  v_obj = a_pos;
  v_onrm = a_nrm;
  gl_Position = u_vp * wp;
}`;

  const FS_MAIN = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_world; in vec3 v_nrm; in vec2 v_uv; in vec3 v_obj; in vec3 v_onrm;
out vec4 fragColor;

uniform vec3 u_camPos;
uniform vec3 u_albedo, u_emissive;
uniform float u_rough, u_metal, u_opacity, u_emissiveStrength;
uniform int u_useTex; uniform sampler2D u_tex; uniform vec2 u_uvScale;
uniform int u_mapMode;            // 0 = Netz-UV, 1 = Box (dreiachsig), 2 = Ebene von oben
uniform vec2 u_uvOffset;
uniform float u_uvRot, u_texSize, u_texStrength;
uniform vec3 u_objScale;
uniform vec3 u_ambient;
uniform vec3 u_sunDir, u_sunColor;
uniform int u_pointCount;
uniform vec3 u_pointPos[6], u_pointColor[6];
uniform float u_pointRange[6];
uniform int u_shadowOn;
uniform mat4 u_lightVP;
uniform sampler2D u_shadowMap;
uniform float u_shadowTexel, u_shadowStrength;
uniform int u_floor; uniform float u_gridSize; uniform vec3 u_gridColor;
uniform int u_unlit;

float shadowFactor(vec3 n, vec3 l){
  if (u_shadowOn == 0) return 1.0;
  vec4 lp = u_lightVP * vec4(v_world, 1.0);
  vec3 pc = lp.xyz / lp.w * 0.5 + 0.5;
  if (pc.x < 0.001 || pc.x > 0.999 || pc.y < 0.001 || pc.y > 0.999 || pc.z > 1.0) return 1.0;
  float bias = max(0.0016 * (1.0 - dot(n, l)), 0.0006);
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float d = texture(u_shadowMap, pc.xy + vec2(float(x), float(y)) * u_shadowTexel).r;
      sum += (pc.z - bias > d) ? 0.0 : 1.0;
    }
  }
  return mix(1.0, sum / 9.0, u_shadowStrength);
}

/* Textur abtasten – Netz-UV, dreiachsige Projektion oder Ebene von oben.
   Bei den Projektionen zählt die Objektgeometrie mal Skalierung, damit die
   Kachelgröße ein Weltmaß ist und beim Strecken nicht verzerrt. */
vec3 sampleTex(){
  if (u_mapMode == 0) {
    vec2 uv = v_uv * u_uvScale;
    if (u_uvRot != 0.0) {
      float c = cos(u_uvRot), s = sin(u_uvRot);
      vec2 q = uv - 0.5;
      uv = vec2(q.x * c - q.y * s, q.x * s + q.y * c) + 0.5;
    }
    return texture(u_tex, uv + u_uvOffset).rgb;
  }
  vec3 sc = max(abs(u_objScale), vec3(0.0001));
  vec3 p = v_obj * sc / max(u_texSize, 0.0001);
  if (u_mapMode == 2) return texture(u_tex, p.xz + u_uvOffset).rgb;

  vec3 w = abs(normalize(v_onrm / sc));
  w = pow(w, vec3(5.0));
  w /= max(w.x + w.y + w.z, 0.0001);
  return texture(u_tex, p.zy + u_uvOffset).rgb * w.x
       + texture(u_tex, p.xz + u_uvOffset).rgb * w.y
       + texture(u_tex, p.xy + u_uvOffset).rgb * w.z;
}

void main(){
  vec3 n = normalize(v_nrm);
  if (!gl_FrontFacing) n = -n;
  vec3 view = normalize(u_camPos - v_world);

  vec3 base = u_albedo;
  if (u_useTex == 1) base *= mix(vec3(1.0), sampleTex(), clamp(u_texStrength, 0.0, 1.0));

  float alpha = u_opacity;
  if (u_floor == 1) {
    vec2 g = abs(fract(v_world.xz / u_gridSize - 0.5) - 0.5) / fwidth(v_world.xz / u_gridSize);
    float line = 1.0 - min(min(g.x, g.y), 1.0);
    vec2 g5 = abs(fract(v_world.xz / (u_gridSize * 5.0) - 0.5) - 0.5) / fwidth(v_world.xz / (u_gridSize * 5.0));
    float line5 = 1.0 - min(min(g5.x, g5.y), 1.0);
    base = mix(base, u_gridColor, clamp(line * 0.55 + line5 * 0.75, 0.0, 1.0));
    float fade = 1.0 - clamp(length(v_world.xz) / 26.0, 0.0, 1.0);
    alpha *= fade * fade;
    if (alpha < 0.004) discard;
  }

  if (u_unlit == 1) { fragColor = vec4(base + u_emissive * u_emissiveStrength, alpha); return; }

  vec3 diffuseCol = base * (1.0 - u_metal * 0.85);
  vec3 specCol = mix(vec3(0.04), base, u_metal);
  float shine = mix(180.0, 4.0, clamp(u_rough, 0.0, 1.0));
  float specK = mix(0.7, 0.06, clamp(u_rough, 0.0, 1.0));

  vec3 col = u_ambient * diffuseCol;

  vec3 l = normalize(-u_sunDir);
  float ndl = max(dot(n, l), 0.0);
  float sh = shadowFactor(n, l);
  vec3 h = normalize(l + view);
  col += u_sunColor * sh * (diffuseCol * ndl + specCol * pow(max(dot(n, h), 0.0), shine) * specK * step(0.001, ndl));

  for (int i = 0; i < 6; i++) {
    if (i >= u_pointCount) break;
    vec3 d = u_pointPos[i] - v_world;
    float dist = length(d);
    vec3 ld = d / max(dist, 0.0001);
    float att = clamp(1.0 - dist / max(u_pointRange[i], 0.0001), 0.0, 1.0);
    att *= att;
    float nl = max(dot(n, ld), 0.0);
    vec3 hh = normalize(ld + view);
    col += u_pointColor[i] * att * (diffuseCol * nl + specCol * pow(max(dot(n, hh), 0.0), shine) * specK * step(0.001, nl));
  }

  col += u_emissive * u_emissiveStrength;
  fragColor = vec4(col, alpha);
}`;

  const VS_DEPTH = `#version 300 es
in vec3 a_pos; uniform mat4 u_vp, u_model;
void main(){ gl_Position = u_vp * u_model * vec4(a_pos, 1.0); }`;

  const FS_DEPTH = `#version 300 es
precision highp float; out vec4 fragColor;
void main(){ fragColor = vec4(1.0); }`;

  const VS_LINE = `#version 300 es
in vec3 a_pos; uniform mat4 u_vp, u_model;
void main(){ gl_Position = u_vp * u_model * vec4(a_pos, 1.0); }`;

  const FS_LINE = `#version 300 es
precision highp float; uniform vec4 u_color; out vec4 fragColor;
void main(){ fragColor = u_color; }`;

  /* ====================================================== Renderer === */

  const SHADOW_SIZE = 1024;
  const MAX_TEX = 2048;

  let gl = null, canvas = null, ready = false, failed = false;
  let progMain = null, progDepth = null, progLine = null;
  let shadowFbo = null, shadowTex = null;
  let lineBuf = null, lineVao = null;
  const meshCache = new WeakMap();
  const texCache = new Map();

  function init() {
    if (ready || failed) return ready;
    canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 480;
    gl = canvas.getContext('webgl2', {
      antialias: true, alpha: true, depth: true,
      preserveDrawingBuffer: true, powerPreference: 'high-performance'
    });
    if (!gl) { failed = true; return false; }

    progMain = program(VS_MAIN, FS_MAIN);
    progDepth = program(VS_DEPTH, FS_DEPTH);
    progLine = program(VS_LINE, FS_LINE);
    if (!progMain || !progDepth || !progLine) { failed = true; return false; }

    shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    lineBuf = gl.createBuffer();
    lineVao = gl.createVertexArray();
    gl.bindVertexArray(lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    const locL = gl.getAttribLocation(progLine, 'a_pos');
    gl.enableVertexAttribArray(locL);
    gl.vertexAttribPointer(locL, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    ready = true;
    return true;
  }

  function program(vsSrc, fsSrc) {
    const vs = shader(gl.VERTEX_SHADER, vsSrc);
    const fs = shader(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[GD] Shader-Link:', gl.getProgramInfoLog(p));
      return null;
    }
    p._u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      p._u[name] = gl.getUniformLocation(p, info.name);
    }
    return p;
  }

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[GD] Shader:', gl.getShaderInfoLog(s), src.slice(0, 200));
      return null;
    }
    return s;
  }

  /** GPU-Puffer eines Netzes (einmal pro Geometrie, geteilt über alle Kacheln) */
  function gpuMesh(mesh) {
    let g = meshCache.get(mesh);
    if (g) return g;
    g = { vao: gl.createVertexArray(), depthVao: gl.createVertexArray(), count: mesh.index.length };
    const pos = gl.createBuffer(), nrm = gl.createBuffer(), uv = gl.createBuffer(), idx = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos); gl.bufferData(gl.ARRAY_BUFFER, mesh.position, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, nrm); gl.bufferData(gl.ARRAY_BUFFER, mesh.normal, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, uv); gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

    gl.bindVertexArray(g.vao);
    bind(progMain, 'a_pos', pos, 3); bind(progMain, 'a_nrm', nrm, 3); bind(progMain, 'a_uv', uv, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    gl.bindVertexArray(g.depthVao);
    bind(progDepth, 'a_pos', pos, 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    gl.bindVertexArray(null);

    g.buffers = [pos, nrm, uv, idx];
    meshCache.set(mesh, g);
    return g;

    function bind(prog, name, buf, size) {
      const loc = gl.getAttribLocation(prog, name);
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
  }

  /* Texturen liegen im Depot (js/core/depot.js); im Modell steht nur
     `depot:<id>`. Ist der Blob noch nicht da, bleibt das Material diesen
     Durchgang unbetextet — 'bereit' unten stößt das Neuzeichnen an. */
  function getTexture(quelle) {
    if (!quelle) return null;
    const src = GD.depot ? GD.depot.aufloesen(quelle) : quelle;
    if (!src) return null;
    let t = texCache.get(src);
    if (t) return t;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([190, 190, 200, 255]));
    t = { tex: tex, loaded: false };
    texCache.set(src, t);
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      t.loaded = true;
      gl3d.events.emit('texture', src);
    };
    img.onerror = () => { t.failed = true; };
    img.src = src;
    if (texCache.size > 48) {
      const first = texCache.keys().next().value;
      if (first !== src) { gl.deleteTexture(texCache.get(first).tex); texCache.delete(first); }
    }
    return t;
  }

  const hex = (c) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c || '#ffffff');
    if (!m) return [1, 1, 1];
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
  };
  const srgb = (c) => c.map((v) => Math.pow(v, 2.2));

  /* ------------------------------------------------------- Zeichnen */

  const FLOOR_MESH = { get value() { return GD.geom3d.get('plane', { round: 0, seg: 1, thin: 0.0001 }); } };

  function renderScene(opt) {
    if (!init()) return false;
    const w = Math.max(2, Math.min(MAX_TEX, Math.round(opt.width)));
    const h = Math.max(2, Math.min(MAX_TEX, Math.round(opt.height)));
    if (canvas.width < w || canvas.height < h) {
      canvas.width = Math.min(MAX_TEX, Math.max(canvas.width, w));
      canvas.height = Math.min(MAX_TEX, Math.max(canvas.height, h));
    }

    const items = opt.items;
    const env = opt.env;
    const cam = opt.camera;

    /* Kamera */
    const proj = M4.perspective((cam.fov || 42) * Math.PI / 180, w / h, cam.near || 0.05, cam.far || 200);
    const view = M4.lookAt(cam.pos, cam.target, [0, 1, 0]);
    const vp = M4.multiply(proj, view);

    /* Szenengrenzen für die Schattenkamera */
    const b = sceneBounds(items);
    const radius = Math.max(0.8, Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2);
    const center = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];

    let sd = env.sunDir || [-0.5, -1, -0.35];
    const sl = Math.hypot(sd[0], sd[1], sd[2]) || 1;
    sd = [sd[0] / sl, sd[1] / sl, sd[2] / sl];

    const shadowsOn = env.shadows !== false && items.length > 0;
    let lightVP = M4.identity();
    if (shadowsOn) {
      const eye = [center[0] - sd[0] * radius * 2.4, center[1] - sd[1] * radius * 2.4, center[2] - sd[2] * radius * 2.4];
      const lv = M4.lookAt(eye, center, Math.abs(sd[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0]);
      const r = radius * 1.5;
      const lp = M4.ortho(-r, r, -r, r, 0.05, radius * 5.2);
      lightVP = M4.multiply(lp, lv);

      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
      gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(progDepth);
      gl.uniformMatrix4fv(progDepth._u.u_vp, false, lightVP);
      for (const it of items) {
        if (it.material && it.material.noShadow) continue;
        const g = gpuMesh(it.mesh);
        gl.uniformMatrix4fv(progDepth._u.u_model, false, it.matrix);
        gl.bindVertexArray(g.depthVao);
        gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0);
      }
      gl.bindVertexArray(null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /* Hauptbild */
    gl.viewport(0, canvas.height - h, w, h);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, canvas.height - h, w, h);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.CULL_FACE);
    const bg = env.background === 'transparent' ? [0, 0, 0, 0] : hex(env.background || '#12151c').concat([1]);
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(progMain);
    const U = progMain._u;
    gl.uniformMatrix4fv(U.u_vp, false, vp);
    gl.uniform3fv(U.u_camPos, cam.pos);
    gl.uniform3fv(U.u_ambient, srgb(hex(env.ambientColor || '#8fa4c4')).map((v) => v * (env.ambient === undefined ? 0.32 : env.ambient)));
    gl.uniform3fv(U.u_sunDir, sd);
    gl.uniform3fv(U.u_sunColor, srgb(hex(env.sunColor || '#ffffff')).map((v) => v * (env.sunIntensity === undefined ? 1.0 : env.sunIntensity)));
    gl.uniform1i(U.u_shadowOn, shadowsOn ? 1 : 0);
    gl.uniformMatrix4fv(U.u_lightVP, false, lightVP);
    gl.uniform1f(U.u_shadowTexel, 1 / SHADOW_SIZE);
    gl.uniform1f(U.u_shadowStrength, env.shadowStrength === undefined ? 0.75 : env.shadowStrength);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.uniform1i(U.u_shadowMap, 1);

    const lights = (opt.lights || []).slice(0, 6);
    gl.uniform1i(U.u_pointCount, lights.length);
    if (lights.length) {
      const pp = new Float32Array(lights.length * 3), pc = new Float32Array(lights.length * 3), pr = new Float32Array(lights.length);
      lights.forEach((L, i) => {
        pp.set(L.pos, i * 3);
        const c = srgb(hex(L.color)).map((v) => v * L.intensity);
        pc.set(c, i * 3);
        pr[i] = L.range;
      });
      gl.uniform3fv(U.u_pointPos, pp);
      gl.uniform3fv(U.u_pointColor, pc);
      gl.uniform1fv(U.u_pointRange, pr);
    }

    const opaque = [], blended = [];
    for (const it of items) ((it.material && it.material.opacity < 0.999) ? blended : opaque).push(it);

    gl.disable(gl.BLEND);
    for (const it of opaque) drawItem(it, U);

    /* Boden mit Raster */
    if (env.floor) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      const s = 30;
      drawItem({
        mesh: FLOOR_MESH.value,
        matrix: M4.compose([0, env.floorY === undefined ? 0 : env.floorY, 0], [0, 0, 0], [s, 1, s]),
        material: {
          color: env.floorColor || '#20242e', opacity: 0.95, rough: 0.95, metal: 0,
          emissive: '#000000', emissiveStrength: 0
        },
        floor: true, gridSize: (env.gridSize || 1) / s, gridColor: env.gridColor || '#3a4354'
      }, U);
      gl.depthMask(true);
    }

    if (blended.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      blended.sort((a, c) => dist(c) - dist(a));
      for (const it of blended) drawItem(it, U);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    /* Linien (Achsen, Auswahlrahmen, Lichtsymbole) */
    if (opt.lines && opt.lines.length) {
      gl.useProgram(progLine);
      gl.uniformMatrix4fv(progLine._u.u_vp, false, vp);
      gl.uniformMatrix4fv(progLine._u.u_model, false, M4.identity());
      gl.bindVertexArray(lineVao);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      for (const grp of opt.lines) {
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
        gl.bufferData(gl.ARRAY_BUFFER, grp.points, gl.DYNAMIC_DRAW);
        const c = hex(grp.color);
        gl.uniform4f(progLine._u.u_color, c[0], c[1], c[2], grp.alpha === undefined ? 1 : grp.alpha);
        if (grp.noDepth) gl.disable(gl.DEPTH_TEST);
        gl.drawArrays(gl.LINES, 0, grp.points.length / 3);
        if (grp.noDepth) gl.enable(gl.DEPTH_TEST);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    }

    gl.disable(gl.SCISSOR_TEST);
    gl.flush();

    /* In das Ziel-Canvas kopieren */
    if (opt.target) {
      const t = opt.target;
      t.canvas.width = w; t.canvas.height = h;
      t.clearRect(0, 0, w, h);
      t.drawImage(canvas, 0, 0, w, h, 0, 0, w, h);
    }
    return true;

    function dist(it) {
      return (it.matrix[12] - cam.pos[0]) ** 2 + (it.matrix[13] - cam.pos[1]) ** 2 + (it.matrix[14] - cam.pos[2]) ** 2;
    }
  }

  const nrmTmp = new Float32Array(9);

  function drawItem(it, U) {
    const g = gpuMesh(it.mesh);
    const m = it.material || {};
    gl.uniformMatrix4fv(U.u_model, false, it.matrix);
    gl.uniformMatrix3fv(U.u_nrmMat, false, M4.normalMatrix(it.matrix, nrmTmp));
    gl.uniform3fv(U.u_albedo, srgb(hex(m.color || '#c8ccd6')));
    gl.uniform3fv(U.u_emissive, srgb(hex(m.emissive || '#000000')));
    gl.uniform1f(U.u_emissiveStrength, m.emissiveStrength || 0);
    gl.uniform1f(U.u_rough, m.rough === undefined ? 0.55 : m.rough);
    gl.uniform1f(U.u_metal, m.metal || 0);
    gl.uniform1f(U.u_opacity, m.opacity === undefined ? 1 : m.opacity);
    gl.uniform1i(U.u_unlit, m.unlit ? 1 : 0);
    gl.uniform1i(U.u_floor, it.floor ? 1 : 0);
    if (it.floor) {
      gl.uniform1f(U.u_gridSize, it.gridSize);
      gl.uniform3fv(U.u_gridColor, srgb(hex(it.gridColor)));
    }
    const t = m.texture ? getTexture(m.texture) : null;
    gl.uniform1i(U.u_useTex, t && !t.failed ? 1 : 0);
    if (t && !t.failed) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.uniform1i(U.u_tex, 0);
      gl.uniform2f(U.u_uvScale, m.uvScale ? m.uvScale[0] : 1, m.uvScale ? m.uvScale[1] : 1);
      gl.uniform2f(U.u_uvOffset, m.uvOffset ? m.uvOffset[0] : 0, m.uvOffset ? m.uvOffset[1] : 0);
      gl.uniform1f(U.u_uvRot, (m.uvRot || 0) * Math.PI / 180);
      gl.uniform1i(U.u_mapMode, m.texMode === 'box' ? 1 : m.texMode === 'planar' ? 2 : 0);
      gl.uniform1f(U.u_texSize, m.texSize === undefined ? 1 : m.texSize);
      gl.uniform1f(U.u_texStrength, m.texStrength === undefined ? 1 : m.texStrength);
      const M = it.matrix;
      gl.uniform3f(U.u_objScale,
        Math.hypot(M[0], M[1], M[2]), Math.hypot(M[4], M[5], M[6]), Math.hypot(M[8], M[9], M[10]));
    }
    gl.bindVertexArray(g.vao);
    gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0);
  }

  function sceneBounds(items) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const p = [0, 0, 0];
    for (const it of items) {
      const b = it.mesh;
      for (let i = 0; i < 8; i++) {
        const c = [i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]];
        M4.point(it.matrix, c, p);
        for (let a = 0; a < 3; a++) { if (p[a] < min[a]) min[a] = p[a]; if (p[a] > max[a]) max[a] = p[a]; }
      }
    }
    if (!isFinite(min[0])) return { min: [-1, -1, -1], max: [1, 1, 1] };
    return { min: min, max: max };
  }

  /* ------------------------------------------------- Strahlentreffer */

  /** Nächstes Objekt entlang eines Strahls (Weltkoordinaten) */
  function pick(items, ro, rd) {
    let best = null;
    const o = [0, 0, 0], d = [0, 0, 0];
    for (const it of items) {
      if (it.pickable === false) continue;
      const inv = M4.invert(it.matrix);
      if (!inv) continue;
      M4.point(inv, ro, o);
      M4.dir(inv, rd, d);
      const t = rayMesh(it.mesh, o, d);
      if (t !== null && (!best || t < best.t)) best = { item: it, t: t };
    }
    if (best) {
      best.point = [ro[0] + rd[0] * best.t, ro[1] + rd[1] * best.t, ro[2] + rd[2] * best.t];
    }
    return best;
  }

  function rayMesh(mesh, o, d) {
    if (rayBox(mesh.min, mesh.max, o, d) === null) return null;
    const P = mesh.position, I = mesh.index;
    let best = null;
    for (let i = 0; i < I.length; i += 3) {
      const t = rayTri(P, I[i] * 3, I[i + 1] * 3, I[i + 2] * 3, o, d);
      if (t !== null && t > 1e-5 && (best === null || t < best)) best = t;
    }
    return best;
  }

  function rayBox(min, max, o, d) {
    let t0 = -Infinity, t1 = Infinity;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < min[a] - 1e-6 || o[a] > max[a] + 1e-6) return null; continue; }
      let ta = (min[a] - o[a]) / d[a], tb = (max[a] - o[a]) / d[a];
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
    return t1 < 0 ? null : Math.max(t0, 0);
  }

  function rayTri(P, ia, ib, ic, o, d) {
    const e1x = P[ib] - P[ia], e1y = P[ib + 1] - P[ia + 1], e1z = P[ib + 2] - P[ia + 2];
    const e2x = P[ic] - P[ia], e2y = P[ic + 1] - P[ia + 1], e2z = P[ic + 2] - P[ia + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) return null;
    const inv = 1 / det;
    const tx = o[0] - P[ia], ty = o[1] - P[ia + 1], tz = o[2] - P[ia + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < -1e-6 || u > 1 + 1e-6) return null;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
    if (v < -1e-6 || u + v > 1 + 1e-6) return null;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return t > 0 ? t : null;
  }

  /* --------------------------------------------------- Animationstakt */

  const animators = new Set();
  let looping = false;

  function tick() {
    looping = animators.size > 0;
    if (!looping) return;
    if (document.hidden) {                   // im Hintergrundtab nichts animieren
      setTimeout(tick, 500);
      return;
    }
    for (const fn of Array.from(animators)) {
      try { fn(); } catch (e) { console.warn('[GD] 3D-Takt:', e); animators.delete(fn); }
    }
    GD.util.nextFrame(tick);
  }

  const gl3d = {
    events: GD.util.emitter(),
    M4: M4,

    get available() { return init(); },

    render: renderScene,
    pick: pick,
    rayBox: rayBox,

    /** Kamerastrahl für einen Punkt in Canvas-Pixeln */
    ray(cam, w, h, px, py) {
      const ndcX = (px / w) * 2 - 1, ndcY = 1 - (py / h) * 2;
      const proj = M4.perspective((cam.fov || 42) * Math.PI / 180, w / h, cam.near || 0.05, cam.far || 200);
      const view = M4.lookAt(cam.pos, cam.target, [0, 1, 0]);
      const inv = M4.invert(M4.multiply(proj, view));
      const a = M4.point(inv, [ndcX, ndcY, -1]);
      const b = M4.point(inv, [ndcX, ndcY, 1]);
      let d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      d = [d[0] / l, d[1] / l, d[2] / l];
      return { origin: cam.pos.slice(), dir: d };
    },

    /** Weltposition aus Umlaufparametern */
    orbitPos(cam) {
      const p = Math.max(-1.53, Math.min(1.53, cam.pitch));
      return [
        cam.target[0] + cam.dist * Math.cos(p) * Math.sin(cam.yaw),
        cam.target[1] + cam.dist * Math.sin(p),
        cam.target[2] + cam.dist * Math.cos(p) * Math.cos(cam.yaw)
      ];
    },

    addAnimator(fn) {
      animators.add(fn);
      if (!looping) { looping = true; GD.util.nextFrame(tick); }
      return () => animators.delete(fn);
    },

    stats() {
      return { textures: texCache.size, contextOk: ready, animators: animators.size };
    }
  };

  if (GD.depot && GD.depot.events) {
    GD.depot.events.on('bereit', () => gl3d.events.emit('texture', null));
  }

  GD.gl3d = gl3d;
  GD.m4 = M4;
})();
