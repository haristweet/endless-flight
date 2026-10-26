// 絵で確かめる台本：決まった時刻のコマを描いて1枚の一覧にする
//   python3 -m http.server 8800 &  node test/shots.mjs [出力.png]
// 曲（無音の WAV）を入れて BAD END にし、被弾の前後を景色・視点・描き方を変えて並べる
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'shots.png';
const LEN = 20; // 曲の長さ（秒）。被弾は 17.4 秒
const TIMES = (process.env.TIMES || '5,15,16.6,17.3,17.55,17.9,18.5,19.6').split(',').map(Number);
const ROWS = JSON.parse(process.env.ROWS || '[["chase","solid","stars",false],["cockpit","solid","desert",false],["chase","solid","city",true],["chase","wire","tunnel",false],["cockpit","solid","volcano",false]]');
const sr = 8000, n = sr * LEN, wav = Buffer.alloc(44 + n * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.error('pageerror', e.message));
await p.goto('http://localhost:8800/');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.setInputFiles('#afile', { name: 'test.wav', mimeType: 'audio/wav', buffer: wav });
await p.waitForFunction(() => typeof snd !== 'undefined' && snd);
const cells = [];
for (const [view, style, scene, deco] of ROWS) for (const t of TIMES) {
  cells.push(await p.evaluate(([view, style, scene, deco, t]) => {
    playing = false; exporting = true;
    Object.assign(cfg, { view, style, deco, aspect: '16:9', seed: 1234, scenes: [scene], badEnd: true });
    const s = newSim(), dt = 1 / 30;
    for (let k = 0; k < Math.round(t / dt); k++) s.update(dt);
    const c = document.createElement('canvas'); c.width = 480; c.height = 270;
    drawFrame(c.getContext('2d'), 480, 270, s, lookFor(s));
    return c.toDataURL();
  }, [view, style, scene, deco, t]));
}
const html = `<body style="margin:0;background:#222;color:#ccc;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(${TIMES.length},240px);gap:2px">`
  + TIMES.map(t => `<div>${t}s</div>`).join('') + cells.map(u => `<img src="${u}" width=240>`).join('') + '</div>';
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('wrote', out);
