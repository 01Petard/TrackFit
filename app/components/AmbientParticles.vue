<script setup lang="ts">
interface MeshParticle {
  anchorX: number
  anchorY: number
  phase: number
  length: number
  width: number
  color: string
  edgeOpacity: number
}

interface MembranePulse {
  x: number
  y: number
  radius: number
  amplitude: number
  pulseSpeed: number
  driftSpeed: number
  orbitX: number
  orbitY: number
  phase: number
}

const canvas = ref<HTMLCanvasElement>()
const rainbowColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#2563eb', '#7c3aed']
const motionSpeed = 1.1
const motionAmplitude = 1.4
const membranePulses: MembranePulse[] = [
  { x: -0.34, y: -0.2, radius: 0.58, amplitude: 18, pulseSpeed: 0.00072, driftSpeed: 0.00014, orbitX: 0.2, orbitY: 0.16, phase: 0.4 },
  { x: 0.28, y: -0.12, radius: 0.5, amplitude: 15, pulseSpeed: 0.00093, driftSpeed: 0.00011, orbitX: 0.24, orbitY: 0.2, phase: 2.1 },
  { x: -0.05, y: 0.36, radius: 0.62, amplitude: 17, pulseSpeed: 0.00061, driftSpeed: 0.00017, orbitX: 0.3, orbitY: 0.13, phase: 4.3 },
  { x: 0.52, y: 0.3, radius: 0.44, amplitude: 13, pulseSpeed: 0.00108, driftSpeed: 0.00013, orbitX: 0.16, orbitY: 0.22, phase: 5.4 },
]
let animationFrame = 0
let particles: MeshParticle[] = []
let reducedMotion: MediaQueryList
let cleanup = () => {}

onMounted(() => {
  const element = canvas.value
  if (!element) return
  const context = element.getContext('2d')
  if (!context) return
  const activeElement: HTMLCanvasElement = element
  const activeContext: CanvasRenderingContext2D = context

  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function particleColor(x: number, y: number, variation: number): string {
    const spectrumPosition = (x * 0.55 + y * 0.9 + variation * 0.12) % 1
    return rainbowColors[Math.min(rainbowColors.length - 1, Math.floor(spectrumPosition * rainbowColors.length))]!
  }

  function createMesh(width: number, height: number): MeshParticle[] {
    const spacing = width < 640 ? 38 : 48
    const centerX = width * 0.5
    const centerY = height * 0.47
    const radiusX = Math.min(width * 0.46, 780)
    const radiusY = Math.min(height * 0.4, 500)
    const columns = Math.ceil(radiusX * 2 / spacing) + 2
    const rows = Math.ceil(radiusY * 2 / spacing) + 2
    const mesh: MeshParticle[] = []

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const jitterX = (Math.random() - 0.5) * spacing * 0.42
        const jitterY = (Math.random() - 0.5) * spacing * 0.42
        const anchorX = centerX - radiusX + column * spacing + jitterX
        const anchorY = centerY - radiusY + row * spacing + jitterY
        const ellipseX = (anchorX - centerX) / radiusX
        const ellipseY = (anchorY - centerY) / radiusY
        const ellipseDistance = Math.hypot(ellipseX, ellipseY)
        if (ellipseDistance > 1) continue
        const normalizedX = (ellipseX + 1) / 2
        const normalizedY = (ellipseY + 1) / 2
        const variation = Math.random()
        mesh.push({
          anchorX,
          anchorY,
          phase: Math.random() * Math.PI * 2,
          length: 2.5 + Math.random() * 6,
          width: 0.85 + Math.random() * 1.35,
          color: particleColor(normalizedX, normalizedY, variation),
          edgeOpacity: Math.min(1, Math.max(0, (1 - ellipseDistance) * 5)),
        })
      }
    }
    return mesh
  }

  function particlePosition(particle: MeshParticle, time: number, width: number, height: number, anchorX = particle.anchorX) {
    const centerX = width * 0.5
    const centerY = height * 0.47
    const radiusX = Math.min(width * 0.46, 780)
    const radiusY = Math.min(height * 0.4, 500)
    const ellipseX = (anchorX - centerX) / radiusX
    const ellipseY = (particle.anchorY - centerY) / radiusY
    const slowVariance = 0.72 + Math.sin(time * 0.00019 + particle.phase * 0.08) * 0.28
    let offsetX = Math.sin(ellipseY * Math.PI * 4.7 + time * 0.00043 + particle.phase * 0.12) * 7 * slowVariance
      + Math.sin((ellipseX + ellipseY) * Math.PI * 2.6 - time * 0.00031) * 4
    let offsetY = Math.cos(ellipseX * Math.PI * 4.1 - time * 0.00037 + particle.phase * 0.1) * 6 * slowVariance
      + Math.sin((ellipseX - ellipseY) * Math.PI * 2.2 + time * 0.00027) * 4

    for (const pulse of membranePulses) {
      const pulseX = pulse.x + Math.sin(time * pulse.driftSpeed + pulse.phase) * pulse.orbitX
      const pulseY = pulse.y + Math.cos(time * pulse.driftSpeed * 1.17 + pulse.phase) * pulse.orbitY
      const deltaX = ellipseX - pulseX
      const deltaY = ellipseY - pulseY
      const distance = Math.max(0.001, Math.hypot(deltaX, deltaY))
      const envelope = Math.exp(-(distance * distance) / (2 * pulse.radius * pulse.radius))
      const deformation = Math.sin(time * pulse.pulseSpeed + pulse.phase + distance * 4.5) * pulse.amplitude * envelope
      offsetX += deltaX / distance * deformation
      offsetY += deltaY / distance * deformation * 0.78
    }

    return { x: anchorX + offsetX * motionAmplitude, y: particle.anchorY + offsetY * motionAmplitude }
  }

  function draw(time: number) {
    const width = window.innerWidth
    const height = window.innerHeight
    const motionTime = time * motionSpeed
    activeContext.clearRect(0, 0, width, height)
    activeContext.lineCap = 'round'
    const baseOpacity = document.documentElement.classList.contains('dark') ? 0.72 : 0.64

    for (const particle of particles) {
      const position = particlePosition(particle, motionTime, width, height)
      const nearby = particlePosition(particle, motionTime, width, height, particle.anchorX + 1)
      const angle = Math.atan2(nearby.y - position.y, nearby.x - position.x)
        + Math.sin(motionTime * 0.00048 + particle.phase) * 0.28
      const pulse = 0.88 + Math.sin(motionTime * 0.00067 + particle.phase) * 0.12
      const localOpacity = 0.8 + Math.sin(motionTime * 0.00041 + particle.phase * 1.3) * 0.2
      const halfLength = particle.length * pulse / 2
      const directionX = Math.cos(angle)
      const directionY = Math.sin(angle)

      activeContext.strokeStyle = particle.color
      activeContext.globalAlpha = baseOpacity * 0.12 * particle.edgeOpacity * localOpacity
      activeContext.lineWidth = particle.width + 2.2
      activeContext.beginPath()
      activeContext.moveTo(position.x - directionX * halfLength, position.y - directionY * halfLength)
      activeContext.lineTo(position.x + directionX * halfLength, position.y + directionY * halfLength)
      activeContext.stroke()

      activeContext.globalAlpha = baseOpacity * pulse * particle.edgeOpacity * localOpacity
      activeContext.lineWidth = particle.width
      activeContext.beginPath()
      activeContext.moveTo(position.x - directionX * halfLength, position.y - directionY * halfLength)
      activeContext.lineTo(position.x + directionX * halfLength, position.y + directionY * halfLength)
      activeContext.stroke()
    }
    activeContext.globalAlpha = 1
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    activeElement.width = Math.round(width * ratio)
    activeElement.height = Math.round(height * ratio)
    activeElement.style.width = `${width}px`
    activeElement.style.height = `${height}px`
    activeContext.setTransform(ratio, 0, 0, ratio, 0, 0)
    particles = createMesh(width, height)
    draw(performance.now())
  }

  function animate(time: number) {
    draw(time)
    animationFrame = requestAnimationFrame(animate)
  }

  function syncMotionPreference() {
    cancelAnimationFrame(animationFrame)
    if (reducedMotion.matches) draw(performance.now())
    else animationFrame = requestAnimationFrame(animate)
  }

  function syncVisibility() {
    if (document.hidden) cancelAnimationFrame(animationFrame)
    else syncMotionPreference()
  }

  resize()
  syncMotionPreference()
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', syncVisibility)
  reducedMotion.addEventListener('change', syncMotionPreference)

  cleanup = () => {
    cancelAnimationFrame(animationFrame)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', syncVisibility)
    reducedMotion.removeEventListener('change', syncMotionPreference)
  }
})

onBeforeUnmount(() => cleanup())
</script>

<template>
  <canvas ref="canvas" aria-hidden="true" class="pointer-events-none fixed inset-0 z-0 size-full" />
</template>
