// 開場動畫：第一人稱視角站在叢林前，往前走兩步，叢林裡浮出五線譜，停在這個畫面顯示「點一下開始」。
// 點下去的那一下同時啟動音訊（app.js 在 document 上監聽 click），開場淡出，鍵盤與五線譜滑進畫面。
//
// 畫風參考繪本：淡薄荷色的天空、每株植物各有自己的綠、葉子上有淺色葉脈、帶斑點的樹幹、零星的花。
// 叢林分成幾層由近到遠的 SVG，每層有自己的「距離」。往前走時，越近的層放大得越多、
// 很快被推出畫面外，遠的層幾乎不動，看起來就像真的往前走；再加上每一步頭部微微上下晃動。
// 遠的層顏色混進天空色，看起來有空氣感。植物用固定種子的亂數產生，每次開場長得一樣。
//
// body 一開始就帶 class="intro"（寫在 index.html），鍵盤與五線譜先藏在畫面外，不會閃一下。
// 動畫播放中點一下也一樣直接開始；系統設定「減少動態效果」時不播動畫，直接顯示最後的畫面。
const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 1600; // 叢林圖層的座標範圍，畫面中心（消失點）在 (800, 450)
const H = 1000;

const FADE_IN_MS = 600;
const WALK_START_MS = 400;
const STEP_MS = 1000; // 走一步的時間，共兩步
const EMERGE_MS = WALK_START_MS + 2 * STEP_MS - 300; // 五線譜在第二步快結束時開始從草叢中間浮現
const GROW_MS = 1800; // 從一個小點長到原本大小的時間
const MIST_MS = EMERGE_MS + GROW_MS - 500; // 霧在五線譜快長好時散開
const PROMPT_MS = MIST_MS + 1400; // 霧散開、五線譜完全清楚後浮現「點一下開始」
const LEAVE_MS = 700; // 淡出時間，要與 styles.css 的 .intro-overlay.leaving 一致
const WALK = 0.7; // 兩步共往前走多遠（與下面各層的 depth 同單位）

// 由遠到近疊放；depth 是離眼睛的距離，畫面上的大小與它成反比。
// haze：顏色混進天空色的比例（越遠越淡）；shade：混進深綠的比例（最近的葉子背光、比較暗）。
const LAYERS = [
  { name: 'far', depth: 4.5, haze: 0.45, shade: 0.05, draw: drawFar },
  { name: 'mid', depth: 2.6, haze: 0.15, shade: 0.12, draw: drawMid },
  // 五線譜浮在中景前面，下方有一叢草，五線譜從草叢中間由小到大浮現
  { name: 'staff', depth: 3.2, haze: 0.1, shade: 0.15, draw: drawStaffGrass },
  { name: 'near', depth: 1.6, haze: 0, shade: 0.22, draw: drawNear },
  { name: 'frame', depth: 1.0, haze: 0, shade: 0.42, draw: drawFrame },
];

const SKY = '#a3bfb3'; // 樹冠下的天光：灰綠、不刺眼
const C = {
  teal: '#1a4f47',
  forest: '#22553a',
  green: '#33713f',
  leaf: '#4a8648',
  lime: '#78a14a',
  olive: '#5d7833',
  sage: '#62907a',
  jade: '#327a6e',
  deep: '#1c3b30',
  bark: '#76503f',
  barkDark: '#4a2e24',
  palmBark: '#9a7859',
  pink: '#f4bccb',
  coral: '#e07a5f',
  yellow: '#f5d35a',
  blue: '#7896dc',
  cream: '#fbf6ea',
};
const GREENS = [C.teal, C.forest, C.green, C.leaf, C.olive, C.jade, C.deep, C.sage, C.lime];

export function playIntro(overlay) {
  const { scene, camera, layers, staffGroup, staff, mist, prompt } = buildScene(overlay);

  scene.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_IN_MS, easing: 'ease-out', fill: 'both' });
  walk(camera, layers);
  emergeStaff(staffGroup, staff, overlay.clientHeight);
  clearMist(mist);
  showPrompt(prompt);

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // 直接跳到最後的畫面；一直重複的呼吸效果也拿掉。
    for (const animation of overlay.getAnimations({ subtree: true })) {
      if (animation.effect.getTiming().iterations === Infinity) animation.cancel();
      else animation.finish();
    }
  }

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    document.body.classList.remove('intro');
    overlay.classList.add('leaving');
    // 淡出期間仍擋住點擊，避免跳過的那一下落到底下的按鈕上。
    setTimeout(() => overlay.remove(), LEAVE_MS);
  }
  // 用 click 而不是 pointerdown：iOS 只在 click、touchend 這類「放開」的手勢裡允許啟動音訊，
  // 開場要等到音訊真的能啟動的那一下才結束。
  overlay.addEventListener('click', finish);
}

// 「點一下開始」在五線譜下方浮現，之後慢慢一明一暗。
function showPrompt(prompt) {
  prompt.animate(
    [
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'none' },
    ],
    { delay: PROMPT_MS, duration: 700, easing: 'ease-out', fill: 'both' },
  );
  prompt.animate([{ opacity: 1 }, { opacity: 0.6 }, { opacity: 1 }], {
    delay: PROMPT_MS + 700,
    duration: 2400,
    iterations: Infinity,
    easing: 'ease-in-out',
  });
}

// 往前走兩步：每層依距離放大，每一步先加速再減速；同時頭部在每次踩地時往下沉、左右微晃。
function walk(camera, layers) {
  const timing = { delay: WALK_START_MS, duration: 2 * STEP_MS, fill: 'both' };
  for (const { el, depth } of layers) {
    const scaleAt = (steps) => depth / (depth - (WALK * steps) / 2);
    el.animate(
      [0, 1, 2].map((steps) => ({ transform: `scale(${scaleAt(steps)})`, easing: 'ease-in-out' })),
      timing,
    );
  }
  camera.animate(
    [
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(14px) rotate(0.6deg)', offset: 0.22 },
      { transform: 'translateY(-4px) rotate(0deg)', offset: 0.5 },
      { transform: 'translateY(14px) rotate(-0.6deg)', offset: 0.72 },
      { transform: 'translateY(0) rotate(0deg)' },
    ].map((frame) => ({ ...frame, easing: 'ease-in-out' })),
    timing,
  );
}

// 五線譜（連同上面的音符）從草叢中間由小到大、由淡到濃浮現：一開始是草叢中間一個幾乎看不見的小點，
// 一邊變大、變清楚一邊移到定位。
// 起點在畫面高度約六成五（草叢中間），定位在四成一，相差的距離要除以五線譜這層走完後的放大倍率。
// 變大與移動套在 group（五線譜＋霧）上，霧會跟著五線譜一起從小點長大、移到定位；淡到濃只套在五線譜上。
function emergeStaff(group, staff, screenHeight) {
  const staffLayer = LAYERS.find((layer) => layer.name === 'staff');
  const offset = Math.round((screenHeight * 0.24 * (staffLayer.depth - WALK)) / staffLayer.depth);
  const timing = { delay: EMERGE_MS, duration: GROW_MS, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'both' };
  group.animate(
    [
      { transform: `translateY(${offset}px) scale(0.05)` },
      { transform: `translateY(${offset * 0.8}px) scale(0.2)`, offset: 0.2 },
      { transform: 'none' },
    ],
    timing,
  );
  // 透明度大部分時間都很淡，快長好時才陡升到不透明（線性時間軸，曲線由關鍵影格決定）
  staff.animate(
    [
      { opacity: 0 },
      { opacity: 0.04, offset: 0.5 },
      { opacity: 0.12, offset: 0.75 },
      { opacity: 0.4, offset: 0.9 },
      { opacity: 1 },
    ],
    { ...timing, easing: 'linear' },
  );
}

// 撥雲見日：五線譜浮現時，霧包著它一起長大（同在 group 裡），快長好時往四面八方散開、變淡，露出五線譜。
function clearMist(puffs) {
  const rnd = random(42);
  puffs.forEach((puff, i) => {
    const angle = (2 * Math.PI * i) / puffs.length + rnd() * 0.5;
    // 每團霧聚在五線譜附近不同的位置、大小不一，看起來是一塊塊的雲，不是一整團光暈（單位是霧團寬高的 %）
    const gx = Math.cos(angle) * (25 + rnd() * 45);
    const gy = Math.sin(angle) * (20 + rnd() * 30);
    const size = 0.6 + rnd() * 0.7;
    const at = (k, scale) => `translate(${gx * k}%, ${gy * k}%) scale(${size * scale})`;
    const gather = MIST_MS - EMERGE_MS;
    puff.animate(
      [
        { opacity: 0, transform: at(0.4, 0.5) },
        { opacity: 0.3 + rnd() * 0.2, transform: at(1, 1), offset: gather / (gather + 1600) },
        { opacity: 0, transform: at(4, 1.8) },
      ],
      { delay: EMERGE_MS + rnd() * 150, duration: gather + 1600, easing: 'ease-out', fill: 'both' },
    );
  });
}

function buildScene(overlay) {
  const scene = div('intro-scene');
  const camera = div('intro-camera');
  const staff = staffSvg();
  const prompt = div('intro-prompt');
  prompt.textContent = '點一下開始';
  const staffGroup = div('intro-staff-group');
  const mist = Array.from({ length: 16 }, () => div('intro-mist'));
  const layers = [];
  for (const layer of LAYERS) {
    let el;
    if (layer.name === 'staff') {
      el = div('intro-layer');
      staffGroup.append(staff, ...mist); // 霧在五線譜前面
      el.append(jungleSvg(layer), staffGroup); // 草叢在五線譜後面
    } else {
      el = jungleSvg(layer);
    }
    camera.append(el);
    layers.push({ el, depth: layer.depth });
  }
  scene.append(camera, prompt);
  overlay.append(scene);
  return { scene, camera, layers, staffGroup, staff, mist, prompt };
}

function div(className) {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function jungleSvg({ depth, haze, shade, draw }) {
  const svg = svgEl('svg', { class: 'intro-layer', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice' });
  const p = painter((color) => mix(mix(color, '#0d2418', shade), SKY, haze));
  draw(p, random(Math.round(depth * 7919)));
  renderItems(svg, p.items);
  return svg;
}

function renderItems(parent, items) {
  for (const item of items) {
    if (item.items) {
      const g = svgEl('g', { transform: item.transform });
      renderItems(g, item.items);
      parent.append(g);
      continue;
    }
    const attrs = item.fill
      ? { d: item.d, fill: item.fill }
      : { d: item.d, fill: 'none', stroke: item.stroke, 'stroke-width': item.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    parent.append(svgEl('path', attrs));
  }
}

// 依畫的順序收集圖形（後畫的蓋在上面）；連續同樣樣式的圖形合併成一條 path，元素少一點。
function painter(tone) {
  const items = [];
  function push(item) {
    const last = items[items.length - 1];
    if (last && last.fill === item.fill && last.stroke === item.stroke && last.width === item.width) last.d += item.d;
    else items.push(item);
  }
  return {
    items,
    fill(d, color) {
      push({ d, fill: tone(color) });
    },
    line(d, color, width) {
      push({ d, stroke: tone(color), width });
    },
    // 一組圖形包在 <g transform> 裡，用來放置動物。
    group(transform, draw) {
      const sub = painter(tone);
      draw(sub);
      items.push({ transform, items: sub.items });
    },
  };
}

// 浮在叢林前的五線譜與四個往上爬的四分音符。
function staffSvg() {
  const svg = svgEl('svg', { class: 'intro-staff', viewBox: '0 0 400 80' });
  for (let i = 0; i < 5; i++) {
    svg.append(svgEl('rect', { x: 20, y: 9 + i * 14, width: 360, height: 2 }));
  }
  [52, 45, 38, 31].forEach((cy, i) => {
    const cx = 130 + i * 50;
    svg.append(
      svgEl('ellipse', { cx, cy, rx: 8.5, ry: 6, transform: `rotate(-20 ${cx} ${cy})` }),
      svgEl('rect', { x: cx + 7, y: cy - 40, width: 2, height: 40 }),
    );
  });
  return svg;
}

// ---- 叢林各層 ----
// p.fill(d, color) 畫色塊、p.line(d, color, width) 畫線（葉脈、莖）；rnd() 回傳 0～1 的亂數。
// 角度：0 朝上、90 朝右、180 朝下、-90 朝左。

// 遠景：整片填滿——後排的樹幹與棕櫚樹、上方的樹冠、下半部密密的灌木。
function drawFar(p, rnd) {
  for (let i = 0; i < 12; i++) jungleTrunk(p, (i + rnd()) * (W / 12), 26 + rnd() * 20, rnd);
  for (let i = 0; i < 7; i++) palmTree(p, (i + 0.2 + rnd() * 0.6) * (W / 7), H, 600 + rnd() * 250, (rnd() - 0.5) * 16, rnd);
  for (let x = -40; x < W + 40; x += 110 + rnd() * 60) {
    leafSpray(p, x, -20, 180, 7, 150, 130 + rnd() * 80, pick(rnd, GREENS), rnd);
  }
  // 中段一排矮樹叢，讓畫面中間也是滿滿的葉子，不會露出一大片天空
  for (let x = -60; x < W + 60; x += 80 + rnd() * 50) {
    const y = 560 + rnd() * 140;
    if (rnd() < 0.5) roundPlant(p, x, y + 160, 180 + rnd() * 80, pick(rnd, GREENS), rnd);
    else leafSpray(p, x, y + 120, 0, 7, 170, 160 + rnd() * 80, pick(rnd, GREENS), rnd);
  }
  for (let x = -60; x < W + 60; x += 90 + rnd() * 60) {
    const y = 620 + rnd() * 120;
    if (rnd() < 0.5) bananaPlant(p, x, y + 260, rnd() < 0.5 ? 1 : -1, 0.6, rnd);
    else strapClump(p, x, y + 200, 260 + rnd() * 120, pick(rnd, GREENS), rnd);
  }
  for (let x = -60; x < W + 60; x += 70 + rnd() * 50) {
    if (rnd() < 0.5) roundPlant(p, x, H + 30, 200 + rnd() * 100, pick(rnd, GREENS), rnd);
    else leafSpray(p, x, H + 30, 0, 7, 150, 180 + rnd() * 120, pick(rnd, GREENS), rnd);
  }
}

// 中景：有斑點的大樹幹、棕櫚樹、攀在樹幹上的龜背芋、垂下來的藤蔓，地上滿是各種葉子與花。
function drawMid(p, rnd) {
  for (const x of [90, 430, 1170, 1510]) {
    jungleTrunk(p, x, 70 + rnd() * 40, rnd);
    const toward = x < 800 ? 1 : -1; // 葉子大多朝畫面中間長
    for (let y = 240; y < 760; y += 170 + rnd() * 80) {
      const side = rnd() < 0.7 ? toward : -toward;
      monstera(p, x + side * 30, y, side * (80 + rnd() * 30), 140 + rnd() * 50, pick(rnd, [C.forest, C.teal, C.green]), rnd);
    }
  }
  for (const x of [640, 960]) palmTree(p, x + (rnd() - 0.5) * 80, H + 40, 820 + rnd() * 100, (x < 800 ? -1 : 1) * 6, rnd);
  for (let x = -60; x < W + 60; x += 170 + rnd() * 80) {
    const angle = (x < 800 ? 150 : -150) + (rnd() - 0.5) * 40;
    palmFrond(p, x, -50, angle, 260 + rnd() * 120, pick(rnd, GREENS), rnd);
  }
  for (const x of [280, 560, 1040, 1320]) vine(p, x + rnd() * 40, 300 + rnd() * 220, rnd);
  for (let x = -60; x < W + 60; x += 110 + rnd() * 70) {
    const kind = rnd();
    const color = pick(rnd, GREENS);
    if (kind < 0.25) roundPlant(p, x, H + 30, 280 + rnd() * 100, color, rnd);
    else if (kind < 0.5) fernClump(p, x, H + 30, 260 + rnd() * 80, 7, color, rnd);
    else if (kind < 0.75) elephantEars(p, x, H + 30, 260 + rnd() * 80, color, rnd);
    else strapClump(p, x, H + 30, 320 + rnd() * 120, color, rnd);
  }
  for (let i = 0; i < 9; i++) daisy(p, rnd() * W, 820 + rnd() * 160, 14 + rnd() * 8, pick(rnd, [C.pink, C.cream, C.yellow, C.blue]), rnd);
  drawAnimals(p, rnd);
  drawTiger(p, rnd);
}

// 五線譜下方的草叢：密密的長草、蕨類與葉子，草尖參差不齊，五線譜從中間浮現。
// 走完兩步後五線譜在這層約佔 x 507～1093，草尖約在 y 480～580（畫面高度六成左右）。
function drawStaffGrass(p, rnd) {
  // 底下先鋪一層灌木，草之間不會透出後面的東西
  for (let x = 400; x <= 1200; x += 50 + rnd() * 30) {
    leafSpray(p, x, H + 60, 0, 7, 150, 340 + rnd() * 60, pick(rnd, GREENS), rnd);
  }
  for (let x = 420; x <= 1180; x += 24 + rnd() * 16) {
    const kind = rnd();
    const color = pick(rnd, GREENS);
    const height = 480 + rnd() * 100;
    if (kind < 0.45) strapClump(p, x, H + 60, height, color, rnd);
    else if (kind < 0.75) fernClump(p, x, H + 60, height * 0.9, 7, color, rnd);
    else leafSpray(p, x, H + 60, 0, 7, 110, height * 0.85, color, rnd);
  }
}

// 近景：兩側與下方的大葉子和花，往前走時會被推到畫面外。
function drawNear(p, rnd) {
  for (let x = -40; x < W + 80; x += 150 + rnd() * 80) {
    const kind = rnd();
    const color = pick(rnd, GREENS);
    if (kind < 0.3) elephantEars(p, x, H + 80, 340 + rnd() * 80, color, rnd);
    else if (kind < 0.6) roundPlant(p, x, H + 80, 320 + rnd() * 80, color, rnd);
    else fernClump(p, x, H + 80, 340 + rnd() * 100, 7, color, rnd);
  }
  for (let i = 0; i < 7; i++) daisy(p, rnd() * W, 860 + rnd() * 120, 22 + rnd() * 10, pick(rnd, [C.pink, C.cream, C.yellow]), rnd);
  // 近景走完兩步後看得到 x 426～1174、y 218～738，青蛙蹲在右下角的圓葉上
  roundLeaf(p, 1030, H + 40, -6, 250, 70, C.green);
  place(p, 1035, 690, 1.7, false, frog);
  for (const [x, dir] of [[-80, 1], [W + 80, -1]]) {
    for (let y = 120; y < 700; y += 200 + rnd() * 80) {
      pointedLeaf(p, x, y, dir * (70 + rnd() * 40), 300 + rnd() * 80, pick(rnd, GREENS), rnd);
    }
  }
}

// 最近的一層：從四周伸到眼前的大葉子，第一步就會從身邊擦過去。
function drawFrame(p, rnd) {
  for (const [x, dir] of [[-140, 1], [W + 140, -1]]) {
    for (let y = 60; y < H; y += 250 + rnd() * 100) {
      if (rnd() < 0.5) monstera(p, x, y, dir * (70 + rnd() * 40), 460 + rnd() * 160, pick(rnd, [C.forest, C.teal, C.deep]), rnd);
      else pointedLeaf(p, x, y, dir * (65 + rnd() * 40), 520 + rnd() * 160, pick(rnd, [C.green, C.forest, C.jade]), rnd);
    }
  }
  bananaLeaf(p, -60, -80, 125, 820, 45, C.leaf, rnd);
  bananaLeaf(p, W + 60, -60, -130, 760, -40, C.olive, rnd);
  palmFrond(p, 420, -120, 175, 600, C.forest, rnd);
  palmFrond(p, 1200, -120, -170, 560, C.teal, rnd);
  fernClump(p, -60, H + 120, 560, 6, C.green, rnd);
  fernClump(p, W + 60, H + 120, 560, 6, C.jade, rnd);
}

// ---- 植物 ----

// 葉脈的顏色：葉子顏色調淡。
const veinOf = (color) => mix(color, '#ffffff', 0.25);
// 背光那一半葉子的顏色：光從左上方來，中肋右側比較暗，葉子看起來有起伏。
const shadeOf = (color) => mix(color, '#0b1f16', 0.25);

// 尖頭的葉子（榕樹、橡膠樹那種），有中肋與斜斜的側脈。
function pointedLeaf(p, x, y, angle, length, color, rnd, detail = 16) {
  const s = spine(x, y, angle, length, droop(angle, 15 + rnd() * 25), detail);
  const width = (t) => length * 0.22 * Math.pow(Math.sin(Math.PI * t), 0.8);
  p.fill(blade(s, width), color);
  p.fill(halfBlade(s, width, 1), shadeOf(color));
  if (length > 60) veins(p, s, width, 6, 0.12, veinOf(color), length / 140);
}

// 一根莖上長出好幾片尖葉（灌木、樹冠）。
function leafSpray(p, x, y, angle, count, spread, length, color, rnd) {
  for (let i = 0; i < count; i++) {
    const a = angle - spread / 2 + (spread * i) / (count - 1) + (rnd() - 0.5) * 14;
    const len = length * (0.7 + rnd() * 0.3) * (1 - Math.abs(i / (count - 1) - 0.5) * 0.4);
    pointedLeaf(p, x, y, a, len, rnd() < 0.3 ? pick(rnd, GREENS) : color, rnd, 10);
  }
}

// 圓葉：長柄頂端一片圓圓的葉子，葉脈從葉柄處呈放射狀散開。
function roundLeaf(p, x, y, angle, stem, r, color) {
  const s = spine(x, y, angle, stem, droop(angle, 15), 4);
  p.line(polyline(sample(s)), mix(color, '#123', 0.2), Math.max(2, r / 14));
  const e = s.at(1);
  const cx = e.x + e.dx * r * 0.8;
  const cy = e.y + e.dy * r * 0.8;
  p.fill(ellipse(cx, cy, r, r * 0.92, deg(Math.atan2(e.dx, -e.dy)), 20), color);
  let d = '';
  for (let k = -3; k <= 3; k++) {
    const phi = rad(k * 24);
    const len = (0.8 * r * Math.cos(phi) + Math.sqrt(r * r - Math.pow(0.8 * r * Math.sin(phi), 2))) * 0.82;
    const a = Math.atan2(e.dx, -e.dy) + phi;
    d += polyline([[e.x, e.y], [e.x + Math.sin(a) * len, e.y - Math.cos(a) * len]]);
  }
  p.line(d, veinOf(color), Math.max(1.5, r / 24));
}

// 一叢圓葉植物：圓葉長在高低不同的柄上，往上散開。
function roundPlant(p, x, y, size, color, rnd) {
  const n = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const angle = -60 + (120 * i) / (n - 1) + (rnd() - 0.5) * 20;
    const shade = rnd() < 0.3 ? mix(color, '#000', 0.15) : color;
    roundLeaf(p, x, y, angle, size * (0.4 + rnd() * 0.5), size * (0.16 + rnd() * 0.06), shade);
  }
}

// 心形葉：葉柄 + 心形葉片，有中肋與側脈。
function heartLeaf(p, x, y, angle, stem, length, color, rnd) {
  let base = { x, y };
  if (stem > 0) {
    const s = spine(x, y, angle, stem, droop(angle, 20), 4);
    p.line(polyline(sample(s)), mix(color, '#123', 0.2), Math.max(2, length / 40));
    base = s.at(1);
  }
  const leafAngle = angle + droop(angle, 30 + rnd() * 30);
  const s = heartSpine(base, leafAngle, length);
  const width = (t) => length * 0.36 * Math.pow(Math.sin(Math.PI * (0.2 + 0.8 * t)), 1.1);
  p.fill(blade(s, width, [base.x, base.y]), color);
  p.fill(halfBlade(s, width, 1, NOTCH, [base.x, base.y]), shadeOf(color));
  veins(p, s, width, 5, 0.1, veinOf(color), length / 120, 0.16);
}

// 心形的兩片耳朵長在葉柄後面：葉片從葉柄往後退一段開始畫，葉基中間凹進去接到葉柄。
const NOTCH = 0.16;
function heartSpine(base, angle, length, detail = 18) {
  const a = rad(angle);
  return spine(base.x - Math.sin(a) * length * NOTCH, base.y + Math.cos(a) * length * NOTCH, angle, length, droop(angle, 15), detail);
}

// 龜背芋：寬大的心形葉，葉緣有一道道深裂。
function monstera(p, x, y, angle, length, color, rnd) {
  const base = { x, y };
  const leafAngle = angle + droop(angle, 30 + rnd() * 30);
  const s = heartSpine(base, leafAngle, length);
  const width = (t) => length * 0.45 * Math.pow(Math.sin(Math.PI * (0.25 + 0.75 * t)), 0.8);
  const cuts = [];
  for (let i = 0; i <= 8; i++) cuts.push(i / 8);
  const shape = { cuts, gap: 0.22, depth: 0.62, slant: 0.1, notch: [x, y] };
  p.fill(segmentedBlade(s, width, shape), color);
  p.fill(segmentedBlade(s, width, { ...shape, side: 1, from: NOTCH }), shadeOf(color));
  p.line(polyline(sample(s, NOTCH, 0.92)), veinOf(color), length / 90);
}

// 姑婆芋：從地面長出幾片長柄的心形葉。
function elephantEars(p, x, y, size, color, rnd) {
  for (let i = 0; i < 4; i++) {
    const angle = -50 + i * 33 + (rnd() - 0.5) * 16;
    heartLeaf(p, x, y, angle, size * (0.7 + rnd() * 0.4), size * (0.5 + rnd() * 0.2), rnd() < 0.3 ? mix(color, '#fff', 0.12) : color, rnd);
  }
}

// 一株香蕉樹：莖往上，頂端長出幾片又長又寬、邊緣裂開的葉子。dir = 1 葉子主要朝右。
function bananaPlant(p, x, y, dir, scale, rnd) {
  const top = y - 520 * scale;
  p.fill(trunkPath(x, 46 * scale, top, y, dir * 20 * scale), C.olive);
  for (let i = 0; i < 5; i++) {
    const angle = dir * (-30 + i * 32 + (rnd() - 0.5) * 16);
    const color = pick(rnd, [C.leaf, C.lime, C.green, C.olive]);
    bananaLeaf(p, x + dir * 20 * scale, top, angle, (380 + rnd() * 120) * scale, droop(angle, 50 + rnd() * 30), color, rnd);
  }
}

// 香蕉葉：長橢圓形，葉緣被風撕成不規則的條狀，有明顯的中肋與平行的側脈。
function bananaLeaf(p, x, y, angle, length, bend, color, rnd) {
  const cuts = [0];
  for (let t = 0.08 + rnd() * 0.1; t < 0.95; t += 0.06 + rnd() * 0.16) cuts.push(t);
  cuts.push(1);
  const width = (t) => length * 0.17 * Math.sqrt(Math.sin(Math.PI * Math.min(1, t * 1.05)));
  const s = spine(x, y, angle, length, bend, 20);
  const shape = { cuts, gap: 0.01, depth: 1, slant: 0.05 };
  p.fill(segmentedBlade(s, width, shape), color);
  p.fill(segmentedBlade(s, width, { ...shape, side: 1 }), shadeOf(color));
  veins(p, s, width, 12, 0.05, veinOf(color), length / 300);
  p.line(polyline(sample(s, 0, 0.97)), veinOf(color), length / 110);
}

// 棕櫚葉：一根彎曲的葉軸，兩側排滿細長、下垂的小葉，越靠葉尖越短。
function palmFrond(p, x, y, angle, length, color, rnd) {
  const s = spine(x, y, angle, length, droop(angle, 40 + rnd() * 30), 16);
  const d = { [-1]: '', 1: '' };
  // 小葉約每 9 個單位一片；小棕櫚的葉片數少一點，看起來一樣密。
  for (let t = 0.06; t < 0.97; t += Math.max(0.028, 9 / length)) {
    const pt = s.at(t);
    const dir = deg(Math.atan2(pt.dx, -pt.dy));
    const len = length * 0.32 * Math.sin(Math.PI * (0.2 + 0.75 * t)) * (0.85 + rnd() * 0.3);
    for (const side of [-1, 1]) {
      const a = dir + side * (35 + rnd() * 15);
      const leaflet = spine(pt.x, pt.y, a, len, droop(a, 30 + rnd() * 20), 6);
      d[side] += blade(leaflet, (u) => len * 0.07 * Math.pow(Math.sin(Math.PI * u), 0.7));
    }
  }
  p.fill(d[-1], color);
  p.fill(d[1], shadeOf(color));
  p.line(polyline(sample(s, 0, 0.95)), veinOf(color), Math.max(1.5, length / 160));
}

// 棕櫚樹：一節一節的樹幹往上彎，頂端一叢往四周下垂的棕櫚葉。
function palmTree(p, x, ground, height, lean, rnd) {
  const s = spine(x, ground, lean, height, -lean * 1.5, 16);
  const w = height / 28;
  const width = (t) => w * (1 - t * 0.35);
  p.fill(blade(s, width), C.palmBark);
  p.fill(halfBlade(s, width, 1), shadeOf(C.palmBark));
  let rings = '';
  for (let t = 0.04; t < 0.98; t += 0.035) {
    const c = s.at(t);
    const l = edgePoint(s, t + 0.012, -1, width(t));
    const r = edgePoint(s, t + 0.012, 1, width(t));
    rings += polyline([l, [c.x, c.y], r]);
  }
  p.line(rings, mix(C.palmBark, C.barkDark, 0.6), Math.max(1.5, w / 6));
  const top = s.at(1);
  for (let i = 0; i < 8; i++) {
    const angle = -130 + i * 37 + (rnd() - 0.5) * 20;
    palmFrond(p, top.x, top.y, angle, height * (0.36 + rnd() * 0.12), pick(rnd, [C.forest, C.green, C.leaf, C.teal]), rnd);
  }
}

// 叢林大樹的樹幹：從地面一直伸到畫面上方，棕色帶深色的橢圓斑點。
function jungleTrunk(p, x, width, rnd) {
  const lean = (rnd() - 0.5) * width;
  p.fill(trunkPath(x, width, -20, H + 20, lean), C.bark);
  p.fill(
    polygon([
      [x + width * 0.1, H + 20],
      [x + width * 0.07 + lean, -20],
      [x + width / 3 + lean, -20],
      [x + width / 2, H + 20],
    ]),
    shadeOf(C.bark),
  );
  let spots = '';
  for (let y = 30; y < H; y += width * (0.7 + rnd() * 0.4)) {
    const t = 1 - y / H; // 0 在地面、1 在頂端
    const cx = x + lean * t + (rnd() - 0.5) * width * 0.5;
    spots += ellipse(cx, y, width * 0.12, width * 0.2, (rnd() - 0.5) * 20, 8);
  }
  p.fill(spots, C.barkDark);
}

// 細長直立的葉子（像虎尾蘭、劍葉），一叢往上散開，葉子中間一條淺色線。
function strapClump(p, x, y, height, color, rnd) {
  for (let i = 0; i < 6; i++) {
    const angle = -40 + i * 16 + (rnd() - 0.5) * 12;
    const len = height * (0.6 + rnd() * 0.4);
    const s = spine(x, y, angle, len, droop(angle, 10 + rnd() * 20), 10);
    const c = rnd() < 0.4 ? pick(rnd, GREENS) : color;
    const width = (t) => len * 0.06 * Math.pow(1 - t, 0.6) + 1;
    p.fill(blade(s, width), c);
    p.fill(halfBlade(s, width, 1), shadeOf(c));
    p.line(polyline(sample(s, 0.05, 0.85)), veinOf(c), Math.max(1.5, len / 140));
  }
}

// 蕨類的一片葉：往上拱起再往下彎，兩側排滿密密的小羽片，越靠葉尖越小。
function fernFrond(p, x, y, angle, length, color, rnd) {
  const s = spine(x, y, angle, length, droop(angle, 50 + rnd() * 40), 12);
  const d = { [-1]: '', 1: '' };
  for (let t = 0.1; t < 0.96; t += Math.max(0.035, 7 / length)) {
    const pt = s.at(t);
    const dir = deg(Math.atan2(pt.dx, -pt.dy));
    const len = length * 0.16 * (1 - t * 0.85);
    for (const side of [-1, 1]) {
      d[side] += blade(spine(pt.x, pt.y, dir + side * 65, len, side * 10, 4), (u) => len * 0.28 * Math.sin(Math.PI * u));
    }
  }
  p.fill(d[-1], color);
  p.fill(d[1], shadeOf(color));
  p.line(polyline(sample(s, 0, 0.95)), veinOf(color), Math.max(1.5, length / 200));
}

// 一叢蕨類：從同一點往兩側拱出去的葉子。
function fernClump(p, x, y, length, count, color, rnd) {
  for (let i = 0; i < count; i++) {
    const angle = -75 + (150 * i) / (count - 1) + (rnd() - 0.5) * 14;
    fernFrond(p, x, y, angle, length * (0.75 + rnd() * 0.35) * (1 - Math.abs(angle) / 300), color, rnd);
  }
}

// 從上方垂下的藤蔓，沿路左右交錯長著小心形葉。
function vine(p, x, length, rnd) {
  const s = spine(x, 0, 180 + (rnd() - 0.5) * 6, length, (rnd() - 0.5) * 10, 8);
  p.line(polyline(sample(s)), C.olive, 3);
  let side = 1;
  for (let t = 0.12; t < 1; t += 0.07 + rnd() * 0.05) {
    const pt = s.at(t);
    const leafAngle = side * (120 + rnd() * 30);
    const size = 26 + rnd() * 14;
    const hs = heartSpine(pt, leafAngle, size, 8);
    p.fill(blade(hs, (u) => size * 0.36 * Math.pow(Math.sin(Math.PI * (0.2 + 0.8 * u)), 1.1), [pt.x, pt.y]), pick(rnd, [C.leaf, C.lime, C.green]));
    side = -side;
  }
}

// 雛菊般的小花：一圈花瓣加上花心。
function daisy(p, x, y, r, color, rnd) {
  const start = rnd() * 360;
  let petals = '';
  for (let i = 0; i < 10; i++) {
    const a = rad(start + i * 36);
    petals += ellipse(x + Math.sin(a) * r * 0.6, y - Math.cos(a) * r * 0.6, r * 0.22, r * 0.5, start + i * 36, 8);
  }
  p.fill(petals, color);
  p.fill(ellipse(x, y, r * 0.3, r * 0.3, 0, 10), color === C.yellow ? C.coral : C.yellow);
}

// 上細下粗的樹幹，lean 是頂端往旁邊歪的距離。
function trunkPath(x, width, top, bottom, lean) {
  return polygon([
    [x - width / 2, bottom],
    [x - width / 3 + lean, top],
    [x + width / 3 + lean, top],
    [x + width / 2, bottom],
  ]);
}

// ---- 動物 ----
// 每隻動物在自己的座標裡畫（原點是腳、坐的位置或掛的地方，y 往上是負的），再用 p.group 放到場景裡。
// 小地方（眼睛、鼻子）要用小數，所以用 circle()／oval() 畫真正的弧線，不用四捨五入的多邊形。

const A = {
  dark: '#2b211d',
  white: '#fdf6ea',
  tiger: '#f0883a',
  tigerEye: '#c9d84a',
  tigerNose: '#c76b5e',
  sloth: '#8f6d52',
  slothFace: '#ead6b8',
  slothMask: '#4a3426',
  monkey: '#b07f55',
  monkeyFace: '#f3cfaa',
  frog: '#69b84a',
  frogDark: '#4f9a36',
  frogBelly: '#d8ec9a',
  frogEye: '#f6e27a',
  toucan: '#22262b',
  toucanWing: '#363d44',
  toucanBib: '#fbe9a6',
  beak: '#f7a531',
  beakTop: '#f8d54a',
  red: '#d8393a',
  eyeBlue: '#6cb8e6',
  macawBlue: '#2f6fd1',
  macawYellow: '#f5c842',
  beakPale: '#efe6d6',
  feet: '#7a8a9a',
};

// 放一隻動物：x, y 是場景座標，size 是縮放，flip 為 true 時左右翻轉。
function place(p, x, y, size, flip, draw) {
  p.group(`translate(${x} ${y}) scale(${flip ? -size : size} ${size})`, draw);
}

// 從樹幹伸出來的橫枝，上面長幾片小葉子。
function branch(p, x1, y1, x2, y2, width, rnd) {
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - 10;
  p.line(`M${x1},${y1}Q${mx},${my} ${x2},${y2}`, C.bark, width);
  for (let i = 0; i < 3; i++) {
    const t = 0.4 + i * 0.25;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t - 6;
    pointedLeaf(p, x, y, (x2 > x1 ? 1 : -1) * (30 + rnd() * 40), 40 + rnd() * 20, pick(rnd, [C.leaf, C.green, C.lime]), rnd, 8);
  }
}

// 側面走路的老虎（朝左）：身體修長、頭小、尾巴長，原點在腳下的地面。
// 遠側的兩條腿顏色深一點，看起來有前後。
function tiger(q) {
  const far = mix(A.tiger, A.dark, 0.3);
  q.fill(limb(-34, -42, -28, -2, 15, 9) + limb(40, -46, 34, -2, 20, 9), far);
  q.fill(oval(-27, -3, 7, 3.5, 0) + oval(33, -3, 7, 3.5, 0), far);
  q.line('M70,-66C94,-66 104,-50 102,-30C101,-18 106,-10 114,-12', A.tiger, 7);
  q.line('M95,-62L99,-58M102,-46L106,-45M101,-32L106,-33M104,-19L108,-21', A.dark, 3);
  q.line('M108,-12C110,-11 112,-11 114,-12', A.dark, 7);
  q.fill('M-58,-74C-44,-86 -10,-82 20,-80C44,-79 64,-78 72,-66C80,-54 76,-40 66,-36C40,-30 -20,-30 -50,-36C-64,-40 -68,-62 -58,-74Z', A.tiger);
  q.fill('M-48,-37C-20,-32 30,-32 62,-37C40,-41 -20,-41 -48,-37Z', A.white);
  // 前腿粗壯；後腿是大腿、往後折的腳踝、再往前落地的腳掌
  q.fill(limb(-46, -46, -54, -3, 19, 12) + oval(56, -56, 19, 22, 12) + limb(60, -42, 70, -18, 17, 10) + limb(70, -18, 64, -3, 10, 10), A.tiger);
  q.fill(oval(-57, -4, 9, 4.5, 0) + oval(61, -4, 8.5, 4.5, 0), A.tiger);
  let stripes = '';
  for (const x of [-40, -26, -12, 2, 16, 30, 44, 58]) {
    stripes += `M${x - 4},-79L${x + 3},-80L${x + 1},-58Z`;
  }
  stripes += 'M-54,-30L-46,-28L-53,-24ZM-56,-18L-49,-16L-56,-12ZM56,-34L66,-32L58,-28ZM60,-22L68,-20L61,-16Z';
  q.fill(stripes, A.dark);
  // 頭圓、口鼻短，臉頰兩側有一圈毛
  q.fill('M-56,-76C-60,-92 -82,-96 -96,-90C-106,-86 -112,-76 -113,-66C-114,-57 -108,-50 -98,-49C-86,-47 -72,-50 -62,-54Z', A.tiger);
  q.fill('M-78,-90C-80,-100 -71,-101 -68,-93Z', A.tiger);
  q.fill('M-77,-92C-78,-97 -73,-98 -71,-94Z', A.dark);
  q.fill('M-113,-64C-114,-56 -108,-50 -99,-50C-93,-50 -89,-54 -91,-58C-98,-60 -106,-62 -113,-64Z' + 'M-90,-56C-84,-48 -72,-48 -66,-56C-72,-61 -84,-61 -90,-56Z', A.white);
  q.fill('M-86,-88L-90,-80L-84,-83ZM-80,-90L-82,-82L-77,-85ZM-70,-78L-62,-74L-70,-72ZM-72,-68L-62,-66L-71,-63Z', A.dark);
  q.fill(oval(-96, -74, 3.6, 2.3, -10), '#e8b440');
  q.fill(circle(-96.8, -74, 1.3) + oval(-112.5, -66, 2.4, 1.8, 0), A.dark);
}

// 停在樹枝上的巨嘴鳥（朝左）。
function toucan(q) {
  q.fill('M6,-30L18,14L8,16L-2,-26Z', A.toucan);
  q.fill(oval(4, -52, 17, 30, 12), A.toucan);
  q.fill(oval(10, -26, 7, 5, 20), A.red);
  q.fill('M10,-74C26,-64 26,-36 14,-24C10,-40 6,-56 10,-74Z', A.toucanWing);
  q.fill(circle(-4, -86, 15), A.toucan);
  q.fill(oval(-10, -72, 10, 13, 10), A.toucanBib);
  q.fill('M-14,-96C-34,-104 -60,-100 -72,-86C-56,-84 -34,-80 -16,-78Z', A.beak);
  q.fill('M-14,-96C-34,-104 -60,-100 -72,-86C-56,-92 -34,-94 -14,-90Z', A.beakTop);
  q.fill('M-60,-97C-66,-94 -70,-90 -72,-86C-66,-86 -62,-87 -58,-88Z', A.red);
  q.fill(circle(-6, -89, 5), A.eyeBlue);
  q.fill(circle(-6, -89, 2.3), A.dark);
  q.fill(circle(-5.2, -90, 0.8), A.white);
  q.line('M0,-22L-2,0M6,-22L6,0', A.feet, 3);
}

// 停在樹枝上的金剛鸚鵡（朝右），長長的尾巴垂下來。
function macaw(q) {
  q.fill('M-4,-20L-16,80L-8,82L4,-18Z', A.red);
  q.fill('M2,-20L-2,86L6,86L8,-18Z', A.macawBlue);
  q.fill(oval(0, -46, 16, 30, -12), A.red);
  q.fill('M-12,-66C2,-64 8,-40 0,-14C-8,-24 -16,-46 -12,-66Z', A.macawYellow);
  q.fill('M-10,-46C0,-42 4,-28 0,-14C-6,-22 -12,-34 -10,-46Z', A.macawBlue);
  q.fill(circle(6, -80, 13), A.red);
  q.fill(oval(12, -80, 7, 6, 0), A.white);
  q.fill(circle(12, -81, 2), A.dark);
  q.fill(circle(12.6, -81.6, 0.7), A.white);
  q.fill('M17,-86C28,-86 30,-74 23,-66C22,-72 20,-75 16,-74Z', A.beakPale);
  q.fill('M16,-74C20,-74 22,-70 20,-67C18,-69 16,-70 15,-71Z', A.dark);
  q.line('M-2,-18L-3,0M4,-18L5,0', A.feet, 3);
}

// 倒掛在樹枝上的樹懶：長長的四肢勾著樹枝，身體垂在下面，頭在前端轉向我們。原點在樹枝上。
function sloth(q) {
  const far = mix(A.sloth, A.dark, 0.25);
  q.fill(limb(-8, 34, -4, 0, 9, 7) + limb(30, 44, 36, 0, 10, 7), far);
  q.fill(oval(12, 44, 38, 22, 8), A.sloth);
  q.line('M0,36L6,48M14,34L20,48M28,38L32,52M4,52L10,60', mix(A.sloth, A.slothFace, 0.35), 2);
  q.fill(limb(-18, 38, -24, 0, 12, 8) + limb(40, 48, 50, 0, 13, 8), A.sloth);
  let claws = '';
  for (const x of [-24, -4, 36, 50]) claws += `M${x - 4},-1C${x - 2},-7 ${x + 4},-7 ${x + 5},-2`;
  q.line(claws, A.dark, 2);
  q.fill(circle(-30, 52, 14), A.sloth);
  q.fill(oval(-32, 54, 10, 8.5, 0), A.slothFace);
  q.fill(oval(-36, 53, 4.5, 2.4, 15) + oval(-27, 53, 4.5, 2.4, -15), A.slothMask);
  q.fill(circle(-35.5, 53, 1.2) + circle(-27.5, 53, 1.2) + oval(-31.5, 58, 2, 1.4, 0), A.dark);
}

// 蹲在樹枝上的猴子（側面朝左）：四肢細長，長尾巴垂下來捲一圈。原點是坐的地方。
function monkey(q) {
  const far = mix(A.monkey, A.dark, 0.25);
  q.line('M12,-4C26,10 24,40 14,58C8,68 14,76 22,72', A.monkey, 4.5);
  q.fill(limb(-2, -44, -16, -2, 6, 5), far);
  q.fill(oval(2, -30, 13, 22, -20), A.monkey);
  q.fill(oval(-5, -28, 7, 15, -20), A.monkeyFace);
  q.fill(oval(-6, -8, 15, 8, -5), A.monkey);
  q.fill(limb(-18, -10, -20, 8, 7, 5) + oval(-23, 9, 5, 2.5, 0), A.monkey);
  q.fill(limb(-6, -46, -24, -3, 7, 5) + oval(-26, -2, 4, 2.5, 0), A.monkey);
  q.fill(circle(-14, -60, 11), A.monkey);
  q.fill(oval(-19, -58, 6.5, 7.5, -10) + oval(-23, -54, 4.5, 3.5, 0) + circle(-5, -62, 3.5), A.monkeyFace);
  q.fill(circle(-20, -61, 1.4) + circle(-26.5, -55, 0.6), A.dark);
  q.line('M-26,-51.5L-22,-51', A.dark, 0.8);
}

// 蹲著的樹蛙（側面朝左）。
function frog(q) {
  q.fill(oval(10, -6, 13, 6, -10) + oval(-2, -1, 8, 2.2, 0), A.frogDark);
  q.fill('M-18,-2C-24,-12 -18,-24 -4,-26C10,-28 22,-20 22,-10C22,-3 14,0 4,0Z', A.frog);
  q.fill('M-18,-2C-10,1 2,1 10,-1C2,-4 -10,-4 -18,-2Z', A.frogBelly);
  q.fill(limb(-10, -8, -14, 0, 4, 3) + oval(-16, -0.5, 4, 1.5, 0) + circle(-10, -24, 5.5), A.frog);
  q.fill(circle(-10, -24.5, 3.8), A.frogEye);
  q.fill(oval(-10, -24.5, 2.6, 1.2, 0) + circle(-21, -17, 0.5), A.dark);
  q.line('M-21,-14L-12,-13', A.frogDark, 0.9);
}

// 中景的動物。位置照 iPad 橫放（4:3）算過：走完兩步後中景看得到的範圍約是 x 314～1286、y 150～820，
// 五線譜佔 x 530～1070、y 340～480，「點一下開始」佔 x 700～900、y 580～630，動物都放在這些空位上。
// 動物都畫成朝左，flip 為 true 時翻過來朝右。方向刻意錯開，有的朝畫面中間、有的朝外，看起來比較自然。
function drawAnimals(p, rnd) {
  branch(p, 560, 196, 830, 188, 13, rnd);
  place(p, 690, 192, 1.5, false, sloth);
  branch(p, 430, 330, 560, 324, 12, rnd);
  place(p, 490, 327, 1.4, true, toucan);
  branch(p, 1170, 330, 1040, 322, 12, rnd);
  place(p, 1120, 326, 1.4, true, macaw);
  branch(p, 430, 610, 600, 600, 14, rnd);
  place(p, 520, 604, 1.5, false, monkey);
}

// 在樹叢間走動的老虎，腳邊補幾叢矮草遮住腳掌。
function drawTiger(p, rnd) {
  place(p, 1120, 700, 1.15, true, tiger);
  for (const x of [1010, 1070, 1140, 1210]) leafSpray(p, x, 715, 0, 7, 150, 40 + rnd() * 20, pick(rnd, GREENS), rnd);
}

// ---- 葉片的幾何 ----

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function pick(rnd, list) {
  return list[Math.floor(rnd() * list.length)];
}

// 兩個 #rrggbb 顏色依 t（0～1）混合。
function mix(a, b, t) {
  if (t <= 0) return a;
  const hex = (c) => (c.length === 4 ? [1, 2, 3].map((i) => parseInt(c[i] + c[i], 16)) : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  const [ca, cb] = [hex(a), hex(b)];
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

// 往下垂的彎曲量：朝右的葉子順時針彎、朝左的逆時針彎，都往地面的方向彎。
function droop(angle, amount) {
  return Math.sin(rad(angle)) >= 0 ? amount : -amount;
}

// 中肋：從 (x, y) 朝 angle 長出 length，方向一路平均轉 bend 度（彎成一段圓弧）。
// at(t)（t = 0～1）回傳中肋上的點、前進方向 (dx, dy) 與右側法向量 (nx, ny)。
function spine(x, y, angle, length, bend, n = 24) {
  const pts = [];
  let px = x;
  let py = y;
  for (let i = 0; i <= n; i++) {
    const a = rad(angle + (bend * i) / n);
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    pts.push({ x: px, y: py, dx, dy, nx: -dy, ny: dx });
    px += (dx * length) / n;
    py += (dy * length) / n;
  }
  return {
    n,
    at(t) {
      const f = Math.min(Math.max(t, 0), 1) * n;
      const i = Math.min(Math.floor(f), n - 1);
      const k = f - i;
      const a = pts[i];
      const b = pts[i + 1];
      const lerp = (key) => a[key] + (b[key] - a[key]) * k;
      return { x: lerp('x'), y: lerp('y'), dx: lerp('dx'), dy: lerp('dy'), nx: lerp('nx'), ny: lerp('ny') };
    },
  };
}

// 中肋從 t0 到 t1 的取樣點。
function sample(s, t0 = 0, t1 = 1) {
  const pts = [];
  for (let i = 0; i <= s.n; i++) {
    const pt = s.at(t0 + ((t1 - t0) * i) / s.n);
    pts.push([pt.x, pt.y]);
  }
  return pts;
}

// 中肋 t 處、往 side 側（-1 左、1 右）離中肋 width 的點。
function edgePoint(s, t, side, width) {
  const pt = s.at(t);
  return [pt.x + pt.nx * width * side, pt.y + pt.ny * width * side];
}

// 葉脈：中肋，加上 count 對從中肋斜向葉緣的側脈（往葉尖斜 slant）。
function veins(p, s, width, count, slant, color, lineWidth, from = 0) {
  let d = polyline(sample(s, from, 0.94));
  for (let k = 1; k <= count; k++) {
    const t = from + ((0.9 - from) * k) / (count + 1);
    const t2 = Math.min(1, t + slant);
    const c = s.at(t);
    for (const side of [-1, 1]) d += polyline([[c.x, c.y], edgePoint(s, t2, side, width(t2) * 0.8)]);
  }
  p.line(d, color, Math.max(1.2, lineWidth));
}

// 完整的葉片：沿中肋兩側各展開 width(t)。給了 notch 時，葉基中間凹進去接到 notch 這一點（心形葉）。
function blade(s, width, notch = null) {
  const left = [];
  const right = [];
  for (let i = 0; i <= s.n; i++) {
    const t = i / s.n;
    left.push(edgePoint(s, t, -1, width(t)));
    right.push(edgePoint(s, t, 1, width(t)));
  }
  return polygon([...(notch ? [notch] : []), ...left, ...right.reverse()]);
}

// 半片葉子：中肋到 side 側（-1 左、1 右）葉緣之間，從 t = from 開始；notch 同 blade()。
function halfBlade(s, width, side, from = 0, notch = null) {
  const edge = [];
  const mid = [];
  for (let i = 0; i <= s.n; i++) {
    const t = from + ((1 - from) * i) / s.n;
    edge.push(edgePoint(s, i === 0 && notch ? 0 : t, side, width(i === 0 && notch ? 0 : t)));
    mid.push(edgePoint(s, t, side, 0));
  }
  return polygon([...(notch ? [notch] : []), ...edge, ...mid.reverse()]);
}

// 裂開的葉片（龜背芋、香蕉葉）：葉緣在 cuts 的位置裂開，每條裂片往葉尖斜（slant），
// 裂到離中肋剩 1 - depth 的地方，裂片之間留 gap（佔一條裂片寬度的比例）。
// 給了 side 時只畫那一側（用來畫背光的半邊），from 是那一側中間沒裂開部分的起點。
function segmentedBlade(s, width, { cuts, gap, depth, slant, notch = null, side: only = 0, from = 0 }) {
  const inner = 1 - depth;
  const innerWidth = (t) => width(t) * inner + 1;
  let d = '';
  if (inner > 0) d = only ? halfBlade(s, innerWidth, only, from, notch) : blade(s, innerWidth, notch);
  for (const side of only ? [only] : [-1, 1]) {
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i];
      const b = cuts[i + 1] - (cuts[i + 1] - a) * gap;
      const pts = [];
      for (let k = 0; k <= 3; k++) {
        const t = a + ((b - a) * k) / 3;
        pts.push(edgePoint(s, t, side, width(t) * inner));
      }
      for (let k = 3; k >= 0; k--) {
        const t = Math.min(1, a + ((b - a) * k) / 3 + slant);
        pts.push(edgePoint(s, t, side, width(t)));
      }
      d += polygon(pts);
    }
  }
  return d;
}

// 以 (cx, cy) 為中心、旋轉 angle 度的橢圓（n 邊形近似）。
function ellipse(cx, cy, rx, ry, angle, n) {
  const a = rad(angle);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    pts.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  return polygon(pts);
}

// 動物用的圓與橢圓：用 SVG 弧線畫，座標保留小數，小小的眼睛也畫得準。
const num = (n) => +n.toFixed(2);
function circle(cx, cy, r) {
  return oval(cx, cy, r, r, 0);
}
function oval(cx, cy, rx, ry, angle) {
  const a = rad(angle);
  const dx = rx * Math.cos(a);
  const dy = rx * Math.sin(a);
  const arc = (x, y) => `A${num(rx)},${num(ry)} ${angle} 1 0 ${num(x)},${num(y)}`;
  return `M${num(cx - dx)},${num(cy - dy)}${arc(cx + dx, cy + dy)}${arc(cx - dx, cy - dy)}Z`;
}

// 動物的四肢：從 (x1, y1) 到 (x2, y2)，粗細從 w1 漸細到 w2，兩端是圓的。
function limb(x1, y1, x2, y2, w1, w2) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const pt = (x, y, w) => `${num(x + nx * w)},${num(y + ny * w)}`;
  const arc = (w, x, y) => `A${num(w)},${num(w)} 0 0 1 ${num(x)},${num(y)}`;
  return `M${pt(x1, y1, w1 / 2)}L${pt(x2, y2, w2 / 2)}${arc(w2 / 2, x2 - nx * (w2 / 2), y2 - ny * (w2 / 2))}L${pt(x1, y1, -w1 / 2)}${arc(w1 / 2, x1 + nx * (w1 / 2), y1 + ny * (w1 / 2))}Z`;
}

const point = ([x, y]) => `${Math.round(x)},${Math.round(y)}`;

function polygon(pts) {
  return `M${pts.map(point).join('L')}Z`;
}

function polyline(pts) {
  return `M${pts.map(point).join('L')}`;
}

// 固定種子的亂數（mulberry32），讓每次開場的叢林長得一樣。
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
