// Realistic 3D fairytale world (Three.js, physically-based rendering):
// a sculpted floating island with a stone castle (glowing windows, glossy
// pastel roofs, gold finials), glass crystals, puffy volumetric clouds,
// glossy hard-cover storybooks you can click, fireflies, soft shadows,
// image-based lighting and bloom. Pauses off-screen; respects reduced motion.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PALETTES } from '../lib/config';

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);

/** cheap smooth value-noise for organic displacement */
function noise3(x, y, z) {
  const s = Math.sin(x * 1.7 + y * 3.1) * Math.cos(z * 2.3 - x * 0.7) + Math.sin(y * 2.9 + z * 1.3) * 0.5 + Math.cos(x * 4.1 - z * 3.7) * 0.25;
  return s / 1.75;
}
function displace(geo, amt, freq = 1) {
  const p = geo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise3(v.x * freq, v.y * freq, v.z * freq);
    v.addScaledVector(v.clone().normalize(), n * amt);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function coverTexture(book) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 680;
  const g = c.getContext('2d');
  const [a, b, ink] = PALETTES[(book.palette ?? 0) % PALETTES.length];
  const grd = g.createLinearGradient(0, 0, 512, 680);
  grd.addColorStop(0, a); grd.addColorStop(1, b);
  g.fillStyle = grd; g.fillRect(0, 0, 512, 680);
  const shine = g.createRadialGradient(150, 120, 10, 150, 120, 380);
  shine.addColorStop(0, 'rgba(255,255,255,.55)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = shine; g.fillRect(0, 0, 512, 680);
  g.strokeStyle = '#e8c56b'; g.lineWidth = 10; g.strokeRect(28, 28, 456, 624);
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.strokeRect(44, 44, 424, 592);
  g.font = '190px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 20; g.shadowOffsetY = 10;
  g.fillText(book.emoji || '📖', 256, 300);
  g.shadowColor = 'transparent';
  g.fillStyle = ink; g.font = 'bold 42px Fredoka, sans-serif';
  const words = book.title.split(' '); let line = ''; let y = 470;
  for (const w of words) {
    if (g.measureText(line + w).width > 400) { g.fillText(line.trim(), 256, y); line = ''; y += 50; }
    line += w + ' ';
  }
  g.fillText(line.trim(), 256, y);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function pagesTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf6ec'; g.fillRect(0, 0, 64, 256);
  for (let x = 0; x < 64; x += 2) { g.fillStyle = `rgba(150,120,100,${rand(0.05, 0.16)})`; g.fillRect(x, 0, 1, 256); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,245,220,.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function skyDome() {
  const geo = new THREE.SphereGeometry(80, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#bcd6ff') }, mid: { value: new THREE.Color('#fbe1f0') }, bottom: { value: new THREE.Color('#fff1e2') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : mix(mid, bottom, smoothstep(0.0, -0.4, h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------- component ----------
export default function FairytaleScene({ books = [], onBookClick }) {
  const mount = useRef(null);
  const clickRef = useRef(onBookClick);
  clickRef.current = onBookClick;
  const bookKey = books.map((b) => b.id).join(',');

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(pointer: coarse)').matches || el.clientWidth < 700;
    let width = el.clientWidth, height = el.clientHeight;

    // --- renderer (PBR, filmic tone mapping, soft shadows)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping; // keeps pastels true (ACES greys them)
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex; // realistic reflections on every material
    scene.environmentIntensity = 0.35;
    scene.add(skyDome());
    scene.fog = new THREE.Fog(0xf6e3f1, 30, 75);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
    camera.position.set(0, 3, 17);

    // --- lights
    scene.add(new THREE.HemisphereLight(0xfff1fa, 0xa9c6f5, 0.45));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
    sun.position.set(6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
    const rim = new THREE.DirectionalLight(0xc7b4ff, 0.9);
    rim.position.set(-8, 4, -6);

    const world = new THREE.Group(); scene.add(world);
    world.add(sun, sun.target, rim); // lights follow the world offset
    const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    // --- materials
    const M = {
      grass: new THREE.MeshStandardMaterial({ color: 0x7fcf95, roughness: 0.85 }),
      rock: new THREE.MeshStandardMaterial({ color: 0xc6b2e3, roughness: 0.75, metalness: 0.02 }),
      rockDark: new THREE.MeshStandardMaterial({ color: 0xa894cf, roughness: 0.8 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xf1e4ec, roughness: 0.55 }),
      roofPink: new THREE.MeshPhysicalMaterial({ color: 0xf59ac2, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 }),
      roofLilac: new THREE.MeshPhysicalMaterial({ color: 0xa996ff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 }),
      roofSky: new THREE.MeshPhysicalMaterial({ color: 0x8fcdfb, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xf2c76a, metalness: 1, roughness: 0.22 }),
      window: new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb84d, emissiveIntensity: 2.2 }),
      door: new THREE.MeshStandardMaterial({ color: 0xb98ad6, roughness: 0.5 }),
      cloud: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
      leaf: [0x72c98c, 0x8fd9a9, 0xf2a0c4, 0xb3a1f5].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
      trunk: new THREE.MeshStandardMaterial({ color: 0xc9a38a, roughness: 0.9 }),
      water: new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, transmission: 0.6, thickness: 0.5, transparent: true, opacity: 0.9 }),
    };

    // --- sculpted floating island
    const island = new THREE.Group();
    const topGeo = new THREE.CylinderGeometry(3.6, 3.3, 0.6, 72, 3);
    { // gentle hills on the grass top
      const p = topGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (y > 0.25) p.setY(i, y + noise3(x * 0.8, 0, z * 0.8) * 0.18);
        const k = 1 + noise3(x, y, z) * 0.04; p.setX(i, x * k); p.setZ(i, z * k);
      }
      topGeo.computeVertexNormals();
    }
    island.add(shadowed(new THREE.Mesh(topGeo, M.grass)));

    const rockGeo = displace(new THREE.ConeGeometry(3.35, 3.6, 72, 16), 0.32, 1.4);
    const rock = shadowed(new THREE.Mesh(rockGeo, M.rock));
    rock.rotation.x = Math.PI; rock.position.y = -2.05; island.add(rock);
    for (let i = 0; i < 9; i++) { // hanging boulders
      const g = displace(new THREE.IcosahedronGeometry(rand(0.25, 0.6), 3), 0.08, 3);
      const b = shadowed(new THREE.Mesh(g, i % 2 ? M.rock : M.rockDark));
      const a = (i / 9) * Math.PI * 2;
      b.position.set(Math.cos(a) * rand(1.4, 2.8), rand(-1.2, -0.3), Math.sin(a) * rand(1.4, 2.6));
      island.add(b);
    }

    // pond + tiny waterfall
    const pond = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), M.water);
    pond.rotation.x = -Math.PI / 2; pond.position.set(2.1, 0.33, 1.3); island.add(pond);
    const fall = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 2.6, 16, 1, true), M.water);
    fall.position.set(2.85, -1.0, 1.75); island.add(fall);

    // --- castle
    const castle = new THREE.Group();
    const keep = shadowed(new THREE.Mesh(new RoundedBoxGeometry(2.3, 2.0, 1.6, 4, 0.06), M.stone));
    keep.position.y = 1.3; castle.add(keep);
    { // crenellations
      const n = 8;
      for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
        const c = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.2, 0.18, 2, 0.03), M.stone));
        c.position.set(-1.15 + 0.15 + i * (2.3 / n), 2.4, s * 0.8); castle.add(c);
      }
    }
    // arched door with gold handle
    const doorShape = new THREE.Shape();
    doorShape.moveTo(-0.32, 0); doorShape.lineTo(-0.32, 0.5); doorShape.absarc(0, 0.5, 0.32, Math.PI, 0, true); doorShape.lineTo(0.32, 0); doorShape.lineTo(-0.32, 0);
    const door = new THREE.Mesh(new THREE.ExtrudeGeometry(doorShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }), M.door);
    door.position.set(0, 0.3, 0.79); castle.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), M.gold); knob.position.set(0.18, 0.62, 0.9); castle.add(knob);

    const windowAt = (x, y, z, s = 1) => {
      const ws = new THREE.Shape();
      ws.moveTo(-0.09 * s, 0); ws.lineTo(-0.09 * s, 0.18 * s); ws.absarc(0, 0.18 * s, 0.09 * s, Math.PI, 0, true); ws.lineTo(0.09 * s, 0);
      const w = new THREE.Mesh(new THREE.ShapeGeometry(ws), M.window);
      w.position.set(x, y, z); castle.add(w);
    };
    windowAt(-0.65, 1.6, 0.81); windowAt(0.65, 1.6, 0.81); windowAt(0, 1.85, 0.81, 1.2);

    const roofMats = [M.roofPink, M.roofLilac, M.roofPink, M.roofSky, M.roofLilac];
    const towers = [[-1.3, 0.75, 3.0, 0.45], [1.3, 0.75, 3.0, 0.45], [0, -0.55, 4.1, 0.55], [-0.75, 0.05, 2.4, 0.33], [0.9, -0.35, 3.4, 0.38]];
    const flags = [];
    towers.forEach(([x, z, h, r], i) => {
      const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 48), M.stone));
      body.position.set(x, h / 2 + 0.3, z); castle.add(body);
      const ring = shadowed(new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, 0.05, 12, 48), M.stone));
      ring.rotation.x = Math.PI / 2; ring.position.set(x, h + 0.3, z); castle.add(ring);
      const roof = shadowed(new THREE.Mesh(new THREE.ConeGeometry(r * 1.45, r * 3.1, 48, 1), roofMats[i]));
      roof.position.set(x, h + 0.3 + r * 1.55, z); castle.add(roof);
      const top = h + 0.3 + r * 3.1;
      const fin = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), M.gold); fin.position.set(x, top + 0.05, z); castle.add(fin);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8), M.gold); pole.position.set(x, top + 0.32, z); castle.add(pole);
      const flagGeo = new THREE.PlaneGeometry(0.4, 0.22, 12, 4); flagGeo.translate(0.2, 0, 0);
      const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffd36e : 0xff9cc8, side: THREE.DoubleSide, roughness: 0.6 }));
      flag.position.set(x + 0.012, top + 0.48, z); flag.userData.base = flagGeo.attributes.position.array.slice();
      castle.add(flag); flags.push(flag);
      windowAt(x, h * 0.55 + 0.3, z + r + 0.005, r * 2);
      windowAt(x, h * 0.85 + 0.3, z + r + 0.005, r * 1.6);
    });
    castle.position.y = 0.3;
    island.add(castle);

    // puffy round trees & mushrooms
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.3;
      const r = rand(2.4, 3.1);
      const t = new THREE.Group();
      const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 10), M.trunk)); trunk.position.y = 0.25; t.add(trunk);
      const leafMat = M.leaf[i % M.leaf.length];
      [[0, 0.65, 0, 0.32], [0.15, 0.55, 0.05, 0.22], [-0.14, 0.58, -0.04, 0.22], [0, 0.85, 0, 0.2]].forEach(([lx, ly, lz, lr]) => {
        const s = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(lr, 3), leafMat)); s.position.set(lx, ly, lz); t.add(s);
      });
      t.position.set(Math.cos(a) * r, 0.35, Math.sin(a) * r * 0.9);
      t.scale.setScalar(rand(0.8, 1.25));
      island.add(t);
    }
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Group();
      const stem = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 10), M.stone)); stem.position.y = 0.08;
      const cap = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.roofPink)); cap.position.y = 0.15;
      m.add(stem, cap);
      const a = rand(0, Math.PI * 2); m.position.set(Math.cos(a) * rand(1.5, 2.2), 0.35, Math.sin(a) * rand(1.5, 2.1));
      island.add(m);
    }
    island.position.set(0, -1.0, 0);
    world.add(island);

    // --- glass crystals orbiting the island
    const crystals = [];
    const tints = [0xffc6e0, 0xd6c8ff, 0xbfe6ff, 0xc9f5d8];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.OctahedronGeometry(rand(0.22, 0.4), 0); g.scale(1, 1.7, 1);
      const mat = new THREE.MeshPhysicalMaterial({
        color: tints[i % 4], roughness: 0.03, transmission: 1, thickness: 1.2, ior: 1.6,
        iridescence: 1, iridescenceIOR: 1.4, clearcoat: 1, envMapIntensity: 1.6,
        attenuationColor: new THREE.Color(tints[i % 4]), attenuationDistance: 0.8,
      });
      const m = new THREE.Mesh(g, mat);
      m.userData = { a: (i / 7) * Math.PI * 2, r: rand(4.2, 5.4), y: rand(-1.4, 2.6), s: rand(0.25, 0.5) };
      m.castShadow = true; crystals.push(m); world.add(m);
    }

    // --- volumetric-looking clouds
    const clouds = [];
    const makeCloud = (scale) => {
      const cl = new THREE.Group();
      const n = 9;
      for (let j = 0; j < n; j++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.45, 0.9), 4), M.cloud);
        s.position.set((j - n / 2) * 0.48 + rand(-0.1, 0.1), Math.sin((j / n) * Math.PI) * 0.45 + rand(-0.1, 0.15), rand(-0.35, 0.35));
        s.scale.y = 0.82; cl.add(s);
      }
      cl.scale.setScalar(scale);
      return cl;
    };
    for (let i = 0; i < 7; i++) {
      const cl = makeCloud(rand(0.6, 1.2));
      cl.position.set(-22 + i * 7, rand(1.5, 6), rand(-14, -5));
      cl.userData.speed = rand(0.12, 0.3);
      clouds.push(cl); world.add(cl);
    }
    const under = makeCloud(1.8); under.position.set(0.5, -5.3, 0.5); world.add(under); // cloud bed under island

    // little floating islets for depth
    const islets = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const t = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.55, 0.18, 32), M.grass));
      const r = shadowed(new THREE.Mesh(displace(new THREE.ConeGeometry(0.55, 0.9, 32, 6), 0.08, 3), M.rock));
      r.rotation.x = Math.PI; r.position.y = -0.54; g.add(t, r);
      g.position.set([-6.5, 6.2, -4][i], [2.6, -0.5, 4.2][i], [-3, -2, -7][i]);
      g.userData = { phase: rand(0, 6), y: g.position.y }; world.add(g); islets.push(g);
    }

    // --- glossy hard-cover storybooks (clickable)
    const bookGroups = [];
    const pagesMat = new THREE.MeshStandardMaterial({ map: pagesTexture(), roughness: 0.9 });
    books.slice(0, 6).forEach((book, i) => {
      const [, spineCol] = PALETTES[(book.palette ?? 0) % PALETTES.length];
      const coverMat = new THREE.MeshPhysicalMaterial({ map: coverTexture(book), roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 });
      const boardMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spineCol), roughness: 0.4, clearcoat: 0.6 });
      const g = new THREE.Group();
      const front = new THREE.Mesh(new RoundedBoxGeometry(1.3, 1.72, 0.05, 3, 0.02), [boardMat, boardMat, boardMat, boardMat, coverMat, boardMat]);
      front.position.z = 0.135;
      const back = new THREE.Mesh(new RoundedBoxGeometry(1.3, 1.72, 0.05, 3, 0.02), boardMat); back.position.z = -0.135;
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.72, 24, 1, false, Math.PI, Math.PI), boardMat);
      spine.scale.z = 0.92; spine.position.x = -0.63;
      const pages = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.64, 0.22), pagesMat); pages.position.x = 0.02;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.05, 24, 1, false, Math.PI, Math.PI), M.gold);
      band.position.set(-0.63, 0.6, 0); band.scale.z = 0.92;
      const band2 = band.clone(); band2.position.y = -0.6;
      [front, back, spine, pages, band, band2].forEach((m) => { m.castShadow = true; m.userData.root = g; g.add(m); });
      g.userData = { book, angle: (i / Math.min(6, books.length)) * Math.PI * 2, radius: 5.6 + (i % 2) * 0.8, y: 1.0 + (i % 3) * 1.0, hover: 0, coverMat };
      bookGroups.push(g); world.add(g);
    });

    // --- fireflies / fairy dust (bloom makes them glow)
    const N = mobile ? 140 : 260;
    const pos = new Float32Array(N * 3); const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-14, 14); pos[i * 3 + 1] = rand(-4, 9); pos[i * 3 + 2] = rand(-10, 5); seeds[i] = rand(0, 100);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dustMat = new THREE.PointsMaterial({ size: 0.16, map: glowTexture(), color: new THREE.Color(0xfff0c8).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    world.add(new THREE.Points(dustGeo, dustMat));

    // --- post-processing: soft magical bloom
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.45, 0.4, 1.25) // only HDR emissives glow;
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // --- interaction
    const mouse = new THREE.Vector2(0, 0);
    const ray = new THREE.Raycaster();
    let hovered = null;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };
    const onClick = () => { if (hovered) clickRef.current?.(hovered.userData.book); };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('click', onClick);

    const onResize = () => {
      width = el.clientWidth; height = el.clientHeight;
      camera.aspect = width / height;
      camera.position.z = width < 700 ? 27 : 17;
      world.position.x = width > 900 ? 3.6 : 0;
      world.position.y = width > 900 ? 0 : 3.4;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);
    onResize();

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);

    const camPos = new THREE.Vector3();
    const timer = new THREE.Timer();
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      timer.update();
      const dt = Math.min(timer.getDelta(), 0.05);
      const t = timer.getElapsed();
      const sp = reduced ? 0.15 : 1;

      island.position.y = -1.0 + Math.sin(t * 0.7) * 0.18 * sp;
      island.rotation.y = Math.sin(t * 0.12) * 0.35 * sp;
      under.position.y = -5.3 + Math.sin(t * 0.7 + 1) * 0.1;

      flags.forEach((f, fi) => { // waving cloth
        const p = f.geometry.attributes.position; const b = f.userData.base;
        for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 14 - t * 6 + fi) * x * 0.25); }
        p.needsUpdate = true;
      });

      crystals.forEach((c) => {
        const u = c.userData; u.a += dt * 0.15 * sp;
        c.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t + u.a * 3) * 0.3, Math.sin(u.a) * u.r * 0.6 - 0.5);
        c.rotation.y += dt * u.s * sp; c.rotation.x = Math.sin(t * 0.5 + u.a) * 0.3;
      });
      clouds.forEach((c) => { c.position.x += dt * c.userData.speed * sp; if (c.position.x > 24) c.position.x = -24; });
      islets.forEach((g) => { g.position.y = g.userData.y + Math.sin(t * 0.8 + g.userData.phase) * 0.2; });

      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(bookGroups, true)[0]?.object?.userData.root || null;
      if (hit !== hovered) { hovered = hit; el.style.cursor = hit ? 'pointer' : 'default'; }

      camPos.copy(camera.position).sub(world.position);
      bookGroups.forEach((g, i) => {
        const u = g.userData;
        u.angle += dt * 0.1 * sp * (g === hovered ? 0.1 : 1);
        u.hover += ((g === hovered ? 1 : 0) - u.hover) * 0.1;
        g.position.set(Math.cos(u.angle) * u.radius, u.y + Math.sin(t * 1.1 + i) * 0.25, Math.sin(u.angle) * u.radius * 0.55);
        g.lookAt(camPos.x, g.position.y, camPos.z);
        g.rotateY(0.45 * (1 - u.hover)); // show the spine & thickness; face you on hover
        g.rotateZ(Math.sin(t * 0.8 + i) * 0.08);
        g.scale.setScalar(1 + u.hover * 0.22);
        u.coverMat.emissiveIntensity = u.hover * 0.12; u.coverMat.emissive.setRGB(1, 1, 1);
      });

      const dp = dustGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        dp.array[i * 3 + 1] += Math.sin(t * 0.6 + seeds[i]) * 0.004;
        dp.array[i * 3] += Math.cos(t * 0.4 + seeds[i]) * 0.003;
      }
      dp.needsUpdate = true;
      dustMat.opacity = 0.7 + Math.sin(t * 2.2) * 0.25;

      // parallax camera
      world.rotation.y += ((mouse.x * 0.16) - world.rotation.y) * 0.04;
      camera.position.x += ((mouse.x * 0.8) - camera.position.x) * 0.03;
      camera.position.y += ((3 + mouse.y * 0.9) - camera.position.y) * 0.03;
      camera.lookAt(world.position.x * 0.4, 1.0 + world.position.y * 0.1, 0);

      composer.render();
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', onResize);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('click', onClick);
      scene.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      envTex.dispose(); pmrem.dispose(); composer.dispose(); renderer.dispose();
      el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey]);

  return <div ref={mount} className="scene" aria-label="Interactive 3D fairytale castle with floating storybooks" />;
}
