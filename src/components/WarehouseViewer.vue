<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface RobotConfig {
  type: string
  count: number
  speed?: number
}

interface ObstacleConfig {
  type: string
  count: number
  arrangement?: string
}

const props = defineProps<{
  config: {
    width: number
    length: number
    robots: number | RobotConfig[]
    shelves?: number
    // 확장 파라미터
    environment?: {
      type?: string
      temperature?: number
      humidity?: number
    }
    obstacles?: ObstacleConfig[]
  }
  status: 'ready' | 'configured' | 'running' | 'completed' | 'error'
  simulationData?: {
    robotPositions?: Array<{ id: string; x: number; y: number; z: number }>
  }
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let robots: THREE.Mesh[] = []
let animationId: number
let isAnimating = false

// 색상 정의
const COLORS = {
  floor: 0x2a2a3a,
  wall: 0x4a4a5a,
  shelf: 0x8b5a2b,
  robot: 0x4a90d9,
  robotActive: 0x5aff5a,
  grid: 0x3a3a4a,
}

const initScene = () => {
  if (!containerRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)
  scene.fog = new THREE.Fog(0x1a1a2e, 50, 100)

  // Camera
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
  camera.position.set(props.config.width * 0.8, props.config.width * 0.6, props.config.length * 0.8)
  camera.lookAt(props.config.width / 2, 0, props.config.length / 2)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(props.config.width / 2, 0, props.config.length / 2)

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(props.config.width, 20, props.config.length)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.add(directionalLight)

  const pointLight = new THREE.PointLight(0x6a6aff, 0.3)
  pointLight.position.set(props.config.width / 2, 10, props.config.length / 2)
  scene.add(pointLight)

  buildWarehouse()
  animate()
}

// 로봇 수 계산 헬퍼
const getRobotCount = (): number => {
  const r = props.config.robots
  if (typeof r === 'number') return r
  if (Array.isArray(r)) {
    return r.reduce((sum, robot) => sum + (robot.count || 1), 0)
  }
  return 3 // 기본값
}

// 로봇 타입별 정보 가져오기
const getRobotTypes = (): Array<{ type: string; count: number }> => {
  const r = props.config.robots
  if (typeof r === 'number') return [{ type: 'AGV', count: r }]
  if (Array.isArray(r)) return r.map(robot => ({ type: robot.type || 'AGV', count: robot.count || 1 }))
  return [{ type: 'AGV', count: 3 }]
}

// 선반 수 계산
const getShelvesCount = (): number => {
  if (props.config.shelves !== undefined) return props.config.shelves
  if (props.config.obstacles) {
    const shelfObstacle = props.config.obstacles.find(o => o.type === 'shelf')
    if (shelfObstacle) return shelfObstacle.count
  }
  return 2 // 기본값
}

const buildWarehouse = () => {
  // Clear existing objects
  while (scene.children.length > 3) {
    const lastChild = scene.children[scene.children.length - 1]
    if (lastChild) scene.remove(lastChild)
  }
  robots = []

  const { width, length } = props.config
  const robotCount = getRobotCount()
  const shelves = getShelvesCount()
  const robotTypes = getRobotTypes()

  // Floor
  const floorGeometry = new THREE.PlaneGeometry(width, length)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.floor,
    roughness: 0.8,
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(width / 2, 0, length / 2)
  floor.receiveShadow = true
  scene.add(floor)

  // Grid
  const gridHelper = new THREE.GridHelper(Math.max(width, length), Math.max(width, length) / 2, COLORS.grid, COLORS.grid)
  gridHelper.position.set(width / 2, 0.01, length / 2)
  scene.add(gridHelper)

  // Walls
  const wallHeight = 5
  const wallThickness = 0.3
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.wall,
    roughness: 0.6,
    transparent: true,
    opacity: 0.7,
  })

  // Front and Back walls
  const wallFBGeometry = new THREE.BoxGeometry(width, wallHeight, wallThickness)
  const wallFront = new THREE.Mesh(wallFBGeometry, wallMaterial)
  wallFront.position.set(width / 2, wallHeight / 2, 0)
  wallFront.castShadow = true
  scene.add(wallFront)

  const wallBack = new THREE.Mesh(wallFBGeometry, wallMaterial)
  wallBack.position.set(width / 2, wallHeight / 2, length)
  wallBack.castShadow = true
  scene.add(wallBack)

  // Left and Right walls
  const wallLRGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, length)
  const wallLeft = new THREE.Mesh(wallLRGeometry, wallMaterial)
  wallLeft.position.set(0, wallHeight / 2, length / 2)
  wallLeft.castShadow = true
  scene.add(wallLeft)

  const wallRight = new THREE.Mesh(wallLRGeometry, wallMaterial)
  wallRight.position.set(width, wallHeight / 2, length / 2)
  wallRight.castShadow = true
  scene.add(wallRight)

  // Shelves
  const shelfMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.shelf,
    roughness: 0.7,
  })
  const shelfWidth = 2.5
  const shelfHeight = 3
  const shelfDepth = length * 0.6

  for (let i = 0; i < shelves; i++) {
    const shelfGeometry = new THREE.BoxGeometry(shelfWidth, shelfHeight, shelfDepth)
    const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial)
    const xPos = width * (i + 1) / (shelves + 1)
    shelf.position.set(xPos, shelfHeight / 2, length / 2)
    shelf.castShadow = true
    shelf.receiveShadow = true
    scene.add(shelf)

    // Shelf items (boxes on shelves)
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xd4a574 })
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 4; k++) {
        const boxGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.5)
        const box = new THREE.Mesh(boxGeometry, boxMaterial)
        box.position.set(
          xPos + (Math.random() - 0.5) * 1.5,
          0.8 + j * 0.9,
          length / 2 + (k - 1.5) * (shelfDepth / 5)
        )
        box.castShadow = true
        scene.add(box)
      }
    }
  }

  // 로봇 타입별 색상
  const ROBOT_COLORS: Record<string, number> = {
    AGV: 0x4a90d9,      // 파랑
    AMR: 0x5aff5a,      // 초록
    FORKLIFT: 0xffa500, // 주황
    ARM: 0xff6b6b,      // 빨강
    HUMANOID: 0x9b59b6, // 보라
  }

  // 로봇 생성 함수
  const createRobot = (type: string, index: number, xPos: number, zPos: number) => {
    const robotGroup = new THREE.Group()
    const color = ROBOT_COLORS[type.toUpperCase()] || COLORS.robot

    const robotMaterial = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.5,
      roughness: 0.3,
    })

    if (type.toUpperCase() === 'FORKLIFT') {
      // 포크리프트 모양
      const bodyGeometry = new THREE.BoxGeometry(1.2, 0.6, 1.5)
      const body = new THREE.Mesh(bodyGeometry, robotMaterial)
      body.position.y = 0.4
      body.castShadow = true
      robotGroup.add(body)

      // 캐빈
      const cabinGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.6)
      const cabinMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a3a })
      const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial)
      cabin.position.set(-0.1, 0.85, 0.3)
      robotGroup.add(cabin)

      // 포크
      const forkMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 })
      const forkGeometry = new THREE.BoxGeometry(0.8, 0.05, 0.1)
      const fork1 = new THREE.Mesh(forkGeometry, forkMaterial)
      fork1.position.set(0.8, 0.15, -0.2)
      robotGroup.add(fork1)
      const fork2 = new THREE.Mesh(forkGeometry, forkMaterial)
      fork2.position.set(0.8, 0.15, 0.2)
      robotGroup.add(fork2)
    } else {
      // AGV/AMR 기본 모양
      const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16)
      const body = new THREE.Mesh(bodyGeometry, robotMaterial)
      body.position.y = 0.25
      body.castShadow = true
      robotGroup.add(body)

      // 상단 플랫폼
      const topGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 16)
      const topMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a3a })
      const top = new THREE.Mesh(topGeometry, topMaterial)
      top.position.y = 0.44
      robotGroup.add(top)

      // 센서
      const sensorGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.15)
      const sensorMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 0.3 })
      const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial)
      sensor.position.set(0.35, 0.35, 0)
      robotGroup.add(sensor)
    }

    // 휠 (공통)
    const wheelGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12)
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    const wheelPositions: [number, number, number][] = [
      [-0.35, 0.12, 0.35],
      [0.35, 0.12, 0.35],
      [-0.35, 0.12, -0.35],
      [0.35, 0.12, -0.35],
    ]
    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, y, z)
      robotGroup.add(wheel)
    })

    // 상태 표시등
    const lightGeometry = new THREE.SphereGeometry(0.06, 12, 12)
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5,
    })
    const light = new THREE.Mesh(lightGeometry, lightMaterial)
    light.position.set(0, 0.55, 0)
    light.name = 'indicator'
    robotGroup.add(light)

    robotGroup.position.set(xPos, 0, zPos)
    robotGroup.userData = {
      id: `${type}_${index + 1}`,
      type: type,
      baseX: xPos,
      baseZ: zPos,
      phase: Math.random() * Math.PI * 2,
    }

    return robotGroup
  }

  // 로봇 배치
  let robotIndex = 0
  robotTypes.forEach(({ type, count }) => {
    for (let i = 0; i < count; i++) {
      const xPos = width * (robotIndex + 1) / (robotCount + 1)
      const zPos = 3 + (robotIndex % 2) * 2
      const robotGroup = createRobot(type, robotIndex, xPos, zPos)
      scene.add(robotGroup)
      robots.push(robotGroup as unknown as THREE.Mesh)
      robotIndex++
    }
  })

  // Update camera
  camera.position.set(width * 0.8, width * 0.5, length * 0.8)
  controls.target.set(width / 2, 0, length / 2)
  controls.update()
}

const animateRobots = () => {
  if (props.status !== 'running') return

  const time = Date.now() * 0.001

  robots.forEach((robotGroup, index) => {
    const userData = robotGroup.userData
    const phase = userData.phase

    // Simple movement pattern
    const moveRange = props.config.length * 0.3
    robotGroup.position.z = userData.baseZ + Math.sin(time + phase) * moveRange
    robotGroup.position.x = userData.baseX + Math.sin(time * 0.5 + phase) * 2

    // Rotate towards movement direction
    const direction = Math.cos(time + phase)
    robotGroup.rotation.y = direction > 0 ? 0 : Math.PI

    // Pulse the indicator light when running
    const indicator = robotGroup.children.find((c: THREE.Object3D) => c.name === 'indicator') as THREE.Mesh
    if (indicator && indicator.material instanceof THREE.MeshStandardMaterial) {
      indicator.material.emissiveIntensity = 0.5 + Math.sin(time * 5) * 0.3
    }
  })
}

const animate = () => {
  animationId = requestAnimationFrame(animate)

  if (props.status === 'running') {
    animateRobots()
  }

  controls.update()
  renderer.render(scene, camera)
}

const handleResize = () => {
  if (!containerRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

watch(() => props.config, () => {
  if (scene) {
    buildWarehouse()
  }
}, { deep: true })

watch(() => props.status, (newStatus) => {
  // Update robot colors based on status
  robots.forEach((robotGroup) => {
    const body = robotGroup.children[0] as THREE.Mesh
    if (body && body.material instanceof THREE.MeshStandardMaterial) {
      if (newStatus === 'running') {
        body.material.color.setHex(COLORS.robotActive)
      } else {
        body.material.color.setHex(COLORS.robot)
      }
    }
  })
})

onMounted(() => {
  initScene()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)

  if (renderer) {
    renderer.dispose()
  }
  if (containerRef.value && renderer) {
    containerRef.value.removeChild(renderer.domElement)
  }
})
</script>

<template>
  <div class="relative w-full h-full">
    <div ref="containerRef" class="w-full h-full" />

    <!-- Status overlay -->
    <div class="absolute top-2 left-2 flex items-center gap-2">
      <span
        class="px-2 py-1 rounded text-xs font-medium"
        :class="{
          'bg-gray-600 text-gray-300': status === 'ready',
          'bg-indigo-500/20 text-indigo-400': status === 'configured',
          'bg-green-500/20 text-green-400': status === 'running',
          'bg-blue-500/20 text-blue-400': status === 'completed',
          'bg-red-500/20 text-red-400': status === 'error',
        }"
      >
        {{
          status === 'ready' ? '대기 중' :
          status === 'configured' ? '설정 완료' :
          status === 'running' ? '시뮬레이션 중' :
          status === 'completed' ? '완료' : '오류'
        }}
      </span>
      <span class="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
        Three.js
      </span>
    </div>

    <!-- Config info -->
    <div class="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-gray-300">
      {{ config.width }}m × {{ config.length }}m | 로봇 {{ config.robots }}대
    </div>

    <!-- Isaac Sim badge -->
    <div class="absolute top-2 right-2 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
      <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
      Isaac Sim 연동
    </div>
  </div>
</template>
