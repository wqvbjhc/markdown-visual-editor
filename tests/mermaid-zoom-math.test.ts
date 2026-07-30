import assert from 'node:assert/strict'
import { fitToScreen, zoomAtPoint, clampScale } from '../src/utils/mermaid-zoom-math.ts'

// fitToScreen：大图缩到整张可见，scale=0.4 居中
let t = fitToScreen({ w: 2000, h: 1000 }, { w: 800, h: 600 }, 0.2)
assert.equal(t.scale, 0.4, '宽图 fit=min(800/2000,600/1000,1)=0.4')
assert.equal(t.tx, (800 - 2000 * 0.4) / 2, '居中 tx')
assert.equal(t.ty, (600 - 1000 * 0.4) / 2, '居中 ty')

// 小图原样 scale=1 居中
t = fitToScreen({ w: 200, h: 100 }, { w: 800, h: 600 }, 0.2)
assert.equal(t.scale, 1, '小图 fit=min(4,6,1)=1')
assert.equal(t.tx, (800 - 200) / 2, '小图居中 tx=300')
assert.equal(t.ty, (600 - 100) / 2, '小图居中 ty=250')

// zoomAtPoint：光标锚点保持不动（scale 1→2，光标(100,100)）
t = zoomAtPoint({ scale: 1, tx: 0, ty: 0 }, { x: 100, y: 100 }, 2, { min: 0.2, max: 5 })
assert.equal(t.scale, 2)
assert.equal(t.tx, -100, '放大2x 光标(100,100)不动 → tx=-100')
assert.equal(t.ty, -100)
// 反向缩回原位
t = zoomAtPoint({ scale: 2, tx: -100, ty: -100 }, { x: 100, y: 100 }, 0.5, { min: 0.2, max: 5 })
assert.equal(t.scale, 1)
assert.equal(t.tx, 0, '缩回光标不动回原位')
assert.equal(t.ty, 0)

// 贴 max 边界：scale 不变 → 平移不动
t = zoomAtPoint({ scale: 5, tx: 10, ty: 20 }, { x: 50, y: 50 }, 2, { min: 0.2, max: 5 })
assert.equal(t.scale, 5, '已贴 max 不再放大')
assert.equal(t.tx, 10, 'scale 未变平移不动')
assert.equal(t.ty, 20)

// 贴 min 边界同理
t = zoomAtPoint({ scale: 0.2, tx: 7, ty: 8 }, { x: 0, y: 0 }, 0.5, { min: 0.2, max: 5 })
assert.equal(t.scale, 0.2)
assert.equal(t.tx, 7)
assert.equal(t.ty, 8)

// clampScale：超 max 钳到 max，平移不动
t = clampScale({ scale: 10, tx: 5, ty: 6 }, { min: 0.2, max: 5 })
assert.equal(t.scale, 5)
assert.equal(t.tx, 5)
assert.equal(t.ty, 6)
// 区间内不动
t = clampScale({ scale: 3, tx: 1, ty: 2 }, { min: 0.2, max: 5 })
assert.equal(t.scale, 3)
assert.equal(t.tx, 1)
assert.equal(t.ty, 2)

console.log('mermaid zoom math ok')
