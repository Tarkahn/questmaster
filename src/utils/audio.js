// Singleton Web Audio API sound engine. All sounds are synthesized — no files needed.

let _ctx = null
let _sfxVolume = 0.7

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

export function setSfxVolume(v) {
  _sfxVolume = Math.max(0, Math.min(1, Number(v) || 0))
}

export function getSfxVolume() { return _sfxVolume }

// Dice rattling noise while rolling
export function playDiceRoll() {
  if (_sfxVolume === 0) return
  const c = ctx()
  const rate = c.sampleRate
  const duration = 0.85
  const buffer = c.createBuffer(1, Math.floor(rate * duration), rate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const env = Math.sin(Math.PI * (i / data.length))
    data[i] = (Math.random() * 2 - 1) * env
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900
  filter.Q.value = 0.8
  const gain = c.createGain()
  gain.gain.value = _sfxVolume * 0.25
  src.connect(filter)
  filter.connect(gain)
  gain.connect(c.destination)
  src.start()
}

// Dice lands — sharp thud
export function playDiceLand() {
  if (_sfxVolume === 0) return
  const c = ctx()
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(180, t)
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.12)
  gain.gain.setValueAtTime(_sfxVolume * 0.55, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.2)
}

// Quest complete — ascending C E G C chime
export function playQuestComplete() {
  if (_sfxVolume === 0) return
  const c = ctx()
  ;[261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
    const t = c.currentTime + i * 0.11
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(_sfxVolume * 0.45, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  })
}

// Mission claim — D F# A D (slightly different flavour from quest)
export function playMissionClaim() {
  if (_sfxVolume === 0) return
  const c = ctx()
  ;[293.66, 369.99, 440.00, 587.33].forEach((freq, i) => {
    const t = c.currentTime + i * 0.11
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(_sfxVolume * 0.4, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  })
}

// Coin earn — bright metallic ding
export function playCoinEarn() {
  if (_sfxVolume === 0) return
  const c = ctx()
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1400, t)
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.12)
  gain.gain.setValueAtTime(_sfxVolume * 0.38, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.45)
}

// Level up — triumphant C E G C E fanfare
export function playLevelUp() {
  if (_sfxVolume === 0) return
  const c = ctx()
  ;[261.63, 329.63, 392.00, 523.25, 659.25].forEach((freq, i) => {
    const t = c.currentTime + i * 0.1
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(_sfxVolume * 0.5, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.5)
  })
}

// Boss strike — low-frequency noise thud
export function playBossStrike() {
  if (_sfxVolume === 0) return
  const c = ctx()
  const rate = c.sampleRate
  const duration = 0.25
  const buffer = c.createBuffer(1, Math.floor(rate * duration), rate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const decay = 1 - i / data.length
    data[i] = (Math.random() * 2 - 1) * decay * decay
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 140
  const gain = c.createGain()
  gain.gain.value = _sfxVolume
  src.connect(filter)
  filter.connect(gain)
  gain.connect(c.destination)
  src.start()
}

// Boss defeat — rising 6-note victory flourish
export function playBossDefeat() {
  if (_sfxVolume === 0) return
  const c = ctx()
  ;[261.63, 329.63, 392.00, 523.25, 659.25, 783.99].forEach((freq, i) => {
    const t = c.currentTime + i * 0.09
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(_sfxVolume * 0.45, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.65)
  })
}
