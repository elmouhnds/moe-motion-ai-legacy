import type { CSSProperties, ReactNode } from 'react'
import { Bar, Collapse, Segmented, Stage, Window, type Act } from '../../kit'
import './moe.css'

// MOE Motion AI · Cloner + Effectors, as a dark After Effects hero.
// Story (how it feels to use): the MOE panel is docked left, the comp viewer
// right, After Effects' timeline under it. The cursor picks Clone, then Clone
// Ring: the selected star layer spirals out into a ring of twelve, and the
// timeline gains MOE Grid 1. It picks Effectors, then Grow: a MOE Effector null
// glides in over the ring's left side, its dashed falloff growing the stars it
// passes, and settles on the right; the timeline gains MOE Effector 1. The
// poster holds that frame. Reset with a seen cause: ⌘Z twice, the effector
// goes, then the copies spiral back into the source.
//
// Real strings: the product, the comp, the three modes, the four preset names
// of the open set, and the layers MOE makes. Everything else is placeholder.

type S = { mode: number; cloned: boolean; eff: boolean; ex: number; fx: number; st: number; sweep: boolean; back: boolean }

// Effector travel, in ring radii from the ring's centre: enters inside the comp
// on the left, rests over the right side (three stars grown)
const START = -1.2
const REST = 0.95
const SWEEP_MS = 2200
const initial: S = { mode: 2, cloned: false, eff: false, ex: START, fx: START, st: 0, sweep: false, back: false }
// the effector's Strength rises with its fade-in (1.5 s), so the stars never grow before it shows
const FADE_MS = 1500
const N = 12

const GEO = {
  wide: { R: 92, item: 24, size: 80, cx: 232, cy: 124, grow: 0.7 },
  // compact: the panel sits above the comp, the ring is smaller and centred in the visible comp
  compact: { R: 54, item: 16, size: 48, cx: 163, cy: 78, grow: 0.5 },
}

// The real Grow effector maths (features/grid/effectors.js): Sphere falloff,
// softness 55 %, Scale +70 % (+50 % at phone width, where the ring is tighter)
function grow(d: number, size: number, amount: number) {
  const inner = size * 0.45
  const sm = (u: number) => u * u * (3 - 2 * u)
  const w = d <= inner ? 1 : d >= size ? 0 : sm((size - d) / (size - inner))
  return 1 + amount * w
}
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)

async function script(a: Act<S>) {
  await a.wait(600)
  // 1. Clone mode, then Clone Ring: the copies spiral out of the source
  await a.move({ at: 'seg-clone', x: 0.5, y: 0.8 })
  await a.click()
  await a.set({ mode: 1 })
  await a.wait(500)
  await a.move({ at: 'tile-ring', x: 0.85, y: 0.3 })
  await a.wait(120)
  await a.click()
  a.mark('clone')
  await a.set({ cloned: true, back: false })
  await a.wait(1500)
  // 2. Effectors, then Grow: the effector enters as it starts to glide
  await a.move({ at: 'seg-eff', x: 0.5, y: 0.8 })
  await a.click()
  await a.set({ mode: 2 })
  await a.wait(500)
  await a.move({ at: 'tile-grow', x: 0.85, y: 0.3 })
  await a.wait(120)
  await a.click()
  a.mark('effector')
  // the null glides on one CSS transition; the stars read the same curve, sampled
  await a.set({ eff: true, sweep: true, ex: REST })
  const t0 = Date.now()
  while (Date.now() - t0 < SWEEP_MS) {
    const u = Math.min(1, (Date.now() - t0) / SWEEP_MS)
    a.put({ fx: START + (REST - START) * easeInOut(u), st: easeInOut(Math.min(1, (Date.now() - t0) / FADE_MS)) })
    await a.wait(32)
  }
  a.put({ fx: REST, st: 1 })
  a.mark('payoff')
  await a.wait(2000)
  // 3. Undo twice in After Effects: the effector, then the clones
  await a.key('cmd+z')
  await a.set({ eff: false })
  // the hand leaves the panel for the empty comp while After Effects undoes
  void a.move({ at: 'rest', x: 0.5, y: 0.5 })
  await a.wait(700)
  await a.key('cmd+z')
  await a.set({ cloned: false, back: true })
  await a.wait(1300)
  await a.snap({ ex: START, fx: START, st: 0, sweep: false, back: false })
}

export default function MoeCloner() {
  return (
    <Stage<S>
      width={760} height={460}
      compact={{ below: 760, width: 358, height: 350 }}
      theme="dark" initial={initial}
      poster={{ mode: 2, cloned: true, eff: true, ex: REST, fx: REST, st: 1, sweep: true, back: false }}
      cursor={{ at: { at: 'rest', x: 0.5, y: 0.5 } }}
      script={script} keys="bottom-right" className="moe">
      {(s, _rect, layout) => {
        const compact = layout === 'compact'
        const g = GEO[compact ? 'compact' : 'wide']
        const ex = s.ex * g.R, fx = s.fx * g.R
        return (
          <Window className="moe-win" title="Launch_Promo" sidebarWidth={228} sidebar={compact ? undefined : <Panel mode={s.mode} compact={false} />}>
            <div className="moe-body">
              {/* on a phone the panel docks above the comp: the switch full width, two tiles side by side */}
              {compact ? <Panel mode={s.mode} compact /> : null}
              <div className="moe-viewer">
                <div className="moe-frame" data-live={s.eff || undefined} style={{ ['--item' as string]: `${g.item}px` } as CSSProperties}>
                  {/* where the cursor rests between beats: empty comp, below-left of the ring */}
                  <span className="moe-rest" data-target="rest" style={{ left: g.cx - g.R * 1.9, top: g.cy + g.R * 0.55 }} />
                  {Array.from({ length: N }, (_, i) => {
                    // a star's slot on the ring; out, it turns in from 50° back along the ring
                    const a = -90 + i * (360 / N), r = s.cloned ? g.R : 0, turn = s.cloned ? 0 : -50
                    const x = r * Math.cos(a * Math.PI / 180), y = r * Math.sin(a * Math.PI / 180)
                    const sc = s.eff ? grow(Math.hypot(x - fx, y), g.size, g.grow * s.st) : 1
                    const style = {
                      left: g.cx, top: g.cy, zIndex: i === 0 ? 1 : 0,
                      // rotate(θ)·translateY(−r) puts a star at (r·sinθ, −r·cosθ): θ = a + 90 is the same point as (x, y) above
                      transform: `translate(-50%, -50%) rotate(${a + 90 + turn}deg) translateY(${-r}px) rotate(${-(a + 90 + turn)}deg) scale(${sc})`,
                      // out in order, back in reverse; once an effector works the ring, the stars answer at once
                      transitionDelay: s.eff ? '0ms' : `${(s.cloned ? i : N - 1 - i) * 35}ms`,
                    } as CSSProperties
                    return <i key={i} className="moe-item" data-sel={(i === 0 && !s.cloned) || undefined} data-back={s.back || undefined} style={style} />
                  })}
                  <div className="moe-eff" data-on={s.eff || undefined} data-sweep={s.sweep || undefined} style={{ left: g.cx, top: g.cy, width: g.size * 2, height: g.size * 2, ['--ex' as string]: `${ex}px` } as CSSProperties}>
                    <span className="moe-null" />
                  </div>
                </div>
              </div>
              {compact ? null : <Timeline cloned={s.cloned} eff={s.eff} />}
            </div>
          </Window>
        )
      }}
    </Stage>
  )
}

/* After Effects' timeline under the viewer: the layers MOE makes arrive at the
   top and carry the stack down (Collapse); the copies are filler rows. */
function Timeline({ cloned, eff }: { cloned: boolean; eff: boolean }) {
  return (
    <div className="moe-tl">
      <div className="moe-tl-head"><Bar w={58} h={6} tone={3} /><Bar w={40} h={6} tone={2} /></div>
      <Collapse open={eff}><Layer label="#ff6a4d" name="MOE Effector 1" /></Collapse>
      <Collapse open={cloned}><Layer label="#e0b44c" name="MOE Grid 1" /></Collapse>
      <Layer label="#5aa2ff" name="Star" />
      {[64, 80, 72].map((w, i) => <Layer key={i} label="#5aa2ff" bar={w} />)}
    </div>
  )
}
function Layer({ label, name, bar }: { label: string; name?: string; bar?: number }) {
  return (
    <div className="moe-layer">
      <i className="moe-chip" style={{ background: label }} />
      {name ? <span className="moe-layer-n">{name}</span> : <Bar w={bar} h={6} tone={2} />}
      <span className="moe-bar" style={{ background: label }} />
    </div>
  )
}

/* The MOE panel, docked: the product, the mode switch and the presets of that
   mode. Both sets stay mounted and crossfade, so a switch never pops. */
function Panel({ mode, compact }: { mode: number; compact: boolean }) {
  return (
    <div className="moe-panel" data-top={compact || undefined}>
      {compact ? null : <div className="moe-brand">MOE Motion AI</div>}
      <Segmented className="moe-seg" items={['Arrange', 'Clone', 'Effectors']} value={mode} targets={[undefined, 'seg-clone', 'seg-eff']} />
      <div className="moe-sets">
        <Tiles on={mode === 1} names={['Clone Ring', 'Clone Grid', 'Sunflower', 'Spiral']} target="tile-ring" arts={[Ring, Dots, Sun, Spiral]} compact={compact} />
        <Tiles on={mode === 2} names={['Grow', 'Reveal', 'Scatter', 'Wave']} target="tile-grow" arts={[GrowArt, Sweep, Scatter, Wave]} compact={compact} />
      </div>
      {compact ? null : (
        <div className="moe-more">
          {[96, 70, 84].map((w, i) => <Bar key={i} w={w} h={6} tone={1} />)}
        </div>
      )}
    </div>
  )
}

function Tiles({ on, names, target, arts, compact }: { on: boolean; names: string[]; target: string; arts: ((p: { focal?: boolean }) => ReactNode)[]; compact: boolean }) {
  return (
    <div className="moe-tiles" data-on={on || undefined} aria-hidden={!on || undefined}>
      {arts.slice(0, compact ? 2 : 4).map((Art, i) => (
        <span key={i} className="moe-tile" data-target={i === 0 && on ? target : undefined}>
          <span className="moe-thumb"><Art focal={i === 0} /></span>
          <span className="moe-tile-l">{names[i]}</span>
        </span>
      ))}
    </div>
  )
}

/* Tile thumbnails: the product's own pictures of each layout and effector,
   as small dot patterns in one ink (the focal tile in the accent). */
const dot = (x: number, y: number, r: number, k: number) => <circle key={k} cx={x} cy={y} r={r} />
function Art({ focal, children }: { focal?: boolean; children: ReactNode }) {
  return <svg viewBox="0 0 80 44" className="moe-art" data-focal={focal || undefined}>{children}</svg>
}
function Ring({ focal }: { focal?: boolean }) { return <Art focal={focal}>{Array.from({ length: 10 }, (_, i) => dot(40 + 15 * Math.cos(i * 0.628), 22 + 15 * Math.sin(i * 0.628), 2.6, i))}</Art> }
function Dots({ focal }: { focal?: boolean }) { return <Art focal={focal}>{Array.from({ length: 15 }, (_, i) => dot(20 + (i % 5) * 10, 12 + Math.floor(i / 5) * 10, 2.4, i))}</Art> }
function Sun({ focal }: { focal?: boolean }) { return <Art focal={focal}>{Array.from({ length: 34 }, (_, i) => dot(40 + 3 * Math.sqrt(i + 0.5) * Math.cos(i * 2.39996), 22 + 3 * Math.sqrt(i + 0.5) * Math.sin(i * 2.39996), 1.5, i))}</Art> }
function Spiral({ focal }: { focal?: boolean }) { return <Art focal={focal}>{Array.from({ length: 16 }, (_, i) => dot(40 + (3 + i * 1.1) * Math.cos(i * 0.62), 22 + (3 + i * 1.1) * Math.sin(i * 0.62), 2, i))}</Art> }
function GrowArt({ focal }: { focal?: boolean }) { return <Art focal={focal}>{Array.from({ length: 15 }, (_, i) => { const x = 16 + (i % 5) * 12, y = 10 + Math.floor(i / 5) * 12, d = Math.hypot(x - 46, y - 22); return dot(x, y, d < 13 ? 4.2 : 2.3, i) })}</Art> }
function Sweep({ focal }: { focal?: boolean }) { return <Art focal={focal}>{Array.from({ length: 15 }, (_, i) => { const x = 16 + (i % 5) * 12; return dot(x, 10 + Math.floor(i / 5) * 12, x < 40 ? 2.6 : 1.1, i) })}</Art> }
function Scatter({ focal }: { focal?: boolean }) { return <Art focal={focal}>{[[14, 12], [27, 30], [36, 9], [48, 25], [60, 13], [66, 33], [22, 20], [55, 36], [44, 17]].map(([x, y], i) => dot(x, y, 2.4, i))}</Art> }
function Wave({ focal }: { focal?: boolean }) { return <Art focal={focal}>{Array.from({ length: 11 }, (_, i) => dot(12 + i * 5.6, 22 + 9 * Math.sin(i * 0.7), 2.3, i))}</Art> }
