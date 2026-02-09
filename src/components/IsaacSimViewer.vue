<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'

const props = defineProps<{
  streamUrl?: string | null
  status: 'ready' | 'configured' | 'running' | 'completed' | 'error'
  config?: {
    width?: number
    height?: number
    robots?: number
  }
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const isStreamAvailable = ref(false)
const isLoading = ref(false)
const connectionStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
const errorMessage = ref('')
const retryCount = ref(0)
const maxRetries = 2  // 최대 2번 재시도 후 Mock 모드로 폴백
const useMockMode = ref(false)  // WebRTC 연결 실패 시 Mock 모드 사용

// WebRTC 관련
let peerConnection: RTCPeerConnection | null = null
let signalingSocket: WebSocket | null = null

// Docker 내부 URL을 외부 접근 가능 URL로 변환
const resolveExternalUrl = (internalUrl: string): string => {
  // isaac-sim 호스트명을 현재 브라우저가 접근한 호스트로 대체
  // (프론트엔드가 EC2에서 서비스되고 있으므로, 같은 IP/도메인 사용)
  const currentHost = window.location.hostname
  return internalUrl
    .replace(/isaac-sim/g, currentHost)
    .replace(/localhost/g, currentHost)
}

// Isaac Sim 스트리밍 URL 계산
const streamingClientUrl = computed(() => {
  if (!props.streamUrl) return null
  // Isaac Sim WebRTC 클라이언트 페이지
  const externalUrl = resolveExternalUrl(props.streamUrl)
  const baseUrl = externalUrl.replace(/\/+$/, '')
  return `${baseUrl}/streaming/webrtc-client`
})

// WebSocket 시그널링 URL
const signalingUrl = computed(() => {
  if (!props.streamUrl) return null
  try {
    const externalUrl = resolveExternalUrl(props.streamUrl)
    const url = new URL(externalUrl)
    // wss for https, ws for http
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${wsProtocol}://${url.host}/streaming/webrtc`
  } catch {
    return null
  }
})

// WebRTC 연결 설정
const setupWebRTC = async () => {
  if (!signalingUrl.value || !videoRef.value) return

  // Mock 모드로 전환된 경우 연결 시도하지 않음
  if (useMockMode.value) {
    console.log('Using Mock mode - WebRTC connection skipped')
    return
  }

  // 최대 재시도 횟수 초과 시 Mock 모드로 전환
  if (retryCount.value >= maxRetries) {
    console.log('Max retries reached, switching to Mock mode')
    useMockMode.value = true
    connectionStatus.value = 'disconnected'
    errorMessage.value = 'Mock 모드로 전환됨'
    isLoading.value = false
    return
  }

  connectionStatus.value = 'connecting'
  isLoading.value = true
  errorMessage.value = ''

  try {
    // RTCPeerConnection 설정
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    }
    peerConnection = new RTCPeerConnection(config)

    // 원격 스트림 수신 시 비디오에 연결
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind)
      if (videoRef.value && event.streams[0]) {
        videoRef.value.srcObject = event.streams[0]
        connectionStatus.value = 'connected'
        isStreamAvailable.value = true
      }
    }

    // ICE 연결 상태 변경
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection?.iceConnectionState)
      if (peerConnection?.iceConnectionState === 'failed') {
        connectionStatus.value = 'error'
        errorMessage.value = 'ICE 연결 실패'
      }
    }

    // 시그널링 WebSocket 연결
    signalingSocket = new WebSocket(signalingUrl.value)

    signalingSocket.onopen = async () => {
      console.log('Signaling WebSocket connected')

      // Offer 생성 및 전송
      const offer = await peerConnection!.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      })
      await peerConnection!.setLocalDescription(offer)

      signalingSocket!.send(JSON.stringify({
        type: 'offer',
        sdp: offer.sdp
      }))
    }

    signalingSocket.onmessage = async (event) => {
      const message = JSON.parse(event.data)
      console.log('Signaling message:', message.type)

      if (message.type === 'answer') {
        await peerConnection!.setRemoteDescription({
          type: 'answer',
          sdp: message.sdp
        })
      } else if (message.type === 'ice-candidate' && message.candidate) {
        await peerConnection!.addIceCandidate(message.candidate)
      }
    }

    signalingSocket.onerror = (error) => {
      console.error('Signaling WebSocket error:', error)
      retryCount.value++
      connectionStatus.value = 'error'
      errorMessage.value = `연결 실패 (${retryCount.value}/${maxRetries})`
      isLoading.value = false

      // 자동 재시도 (최대 횟수 이내)
      if (retryCount.value < maxRetries) {
        setTimeout(() => setupWebRTC(), 2000)
      } else {
        useMockMode.value = true
        errorMessage.value = 'Mock 모드 (스트리밍 불가)'
      }
    }

    signalingSocket.onclose = () => {
      console.log('Signaling WebSocket closed')
      if (connectionStatus.value === 'connecting') {
        retryCount.value++
        connectionStatus.value = 'error'
        errorMessage.value = `연결 종료 (${retryCount.value}/${maxRetries})`

        // 자동 재시도 (최대 횟수 이내)
        if (retryCount.value < maxRetries) {
          setTimeout(() => setupWebRTC(), 2000)
        } else {
          useMockMode.value = true
          errorMessage.value = 'Mock 모드 (스트리밍 불가)'
        }
      }
      isLoading.value = false
    }

    // ICE Candidate 전송
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && signalingSocket?.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }))
      }
    }

  } catch (error) {
    console.error('WebRTC setup error:', error)
    connectionStatus.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '연결 실패'
    isLoading.value = false
  }
}

// 연결 종료
const closeConnection = () => {
  if (signalingSocket) {
    signalingSocket.close()
    signalingSocket = null
  }
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
  connectionStatus.value = 'disconnected'
  isStreamAvailable.value = false
}

// 스트림 URL 변경 감지
watch(() => props.streamUrl, (newUrl, oldUrl) => {
  if (newUrl !== oldUrl) {
    closeConnection()
    if (newUrl) {
      // 약간의 딜레이 후 연결 시도
      setTimeout(() => setupWebRTC(), 500)
    }
  }
})

// 상태가 running으로 변경되면 연결 시도
watch(() => props.status, (newStatus) => {
  if (newStatus === 'running' && props.streamUrl && connectionStatus.value === 'disconnected') {
    setupWebRTC()
  }
})

onMounted(() => {
  if (props.streamUrl && props.status === 'running') {
    setupWebRTC()
  }
})

onUnmounted(() => {
  closeConnection()
})

// 상태별 아이콘 및 색상
const statusConfig = {
  ready: { icon: 'cube', color: 'gray', text: '환경 설정 후 프리뷰 표시' },
  configured: { icon: 'check', color: 'indigo', text: '환경 설정 완료 - 시뮬레이션 시작 대기' },
  running: { icon: 'spinner', color: 'amber', text: '시뮬레이션 실행 중...' },
  completed: { icon: 'check-circle', color: 'green', text: '시뮬레이션 완료' },
  error: { icon: 'exclamation', color: 'red', text: '오류 발생' }
}

// 연결 재시도 (수동)
const retryConnection = () => {
  closeConnection()
  retryCount.value = 0  // 수동 재시도 시 카운터 리셋
  useMockMode.value = false
  setTimeout(() => setupWebRTC(), 500)
}
</script>

<template>
  <div class="w-full h-full bg-gray-900 rounded-lg overflow-hidden relative">
    <!-- WebRTC 비디오 스트림 -->
    <video
      v-show="isStreamAvailable && connectionStatus === 'connected'"
      ref="videoRef"
      autoplay
      playsinline
      muted
      class="w-full h-full object-contain bg-black"
    />

    <!-- iframe 폴백 (WebRTC 직접 연결 실패 시) -->
    <iframe
      v-if="streamingClientUrl && !isStreamAvailable && connectionStatus === 'error'"
      :src="streamingClientUrl"
      class="w-full h-full border-0"
      allow="autoplay; fullscreen"
    />

    <!-- 스트림 없거나 Mock 모드인 경우 - 시각적 표현 -->
    <div
      v-if="!isStreamAvailable && connectionStatus !== 'connected'"
      class="w-full h-full flex flex-col items-center justify-center"
    >
      <!-- 3D 시각화 대체 (CSS 애니메이션) -->
      <div v-if="status === 'running'" class="relative w-48 h-48">
        <!-- 창고 바닥 -->
        <div class="absolute inset-4 border-2 border-gray-600 rounded bg-gray-800/50">
          <!-- 그리드 라인 -->
          <div class="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-0">
            <div v-for="i in 16" :key="i" class="border border-gray-700/30"></div>
          </div>
        </div>

        <!-- 로봇들 (애니메이션) -->
        <div
          v-for="i in Math.min(config?.robots || 3, 5)"
          :key="i"
          class="absolute w-4 h-4 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/50"
          :style="{
            animation: `moveRobot${i} ${3 + i * 0.5}s ease-in-out infinite`,
            left: `${20 + (i * 25) % 60}%`,
            top: `${30 + (i * 15) % 40}%`
          }"
        >
          <div class="absolute inset-0 bg-indigo-400 rounded-full animate-ping opacity-20"></div>
        </div>

        <!-- 선반 -->
        <div class="absolute top-8 left-8 right-8 h-3 bg-amber-700/60 rounded"></div>
        <div class="absolute bottom-8 left-8 right-8 h-3 bg-amber-700/60 rounded"></div>
      </div>

      <!-- 상태 아이콘 (다른 상태) -->
      <div v-else class="text-center" :class="`text-${statusConfig[status].color}-400`">
        <!-- Ready -->
        <svg v-if="status === 'ready'" class="w-16 h-16 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>

        <!-- Configured -->
        <svg v-if="status === 'configured'" class="w-16 h-16 mx-auto mb-2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>

        <!-- Completed -->
        <svg v-if="status === 'completed'" class="w-16 h-16 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M5 13l4 4L19 7" />
        </svg>

        <!-- Error -->
        <svg v-if="status === 'error'" class="w-16 h-16 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <!-- 상태 텍스트 -->
      <p class="text-sm mt-4" :class="`text-${statusConfig[status].color}-400`">
        {{ statusConfig[status].text }}
      </p>

      <!-- 연결 상태 표시 (running 상태일 때) -->
      <div v-if="status === 'running' && streamUrl" class="mt-2 text-xs">
        <span v-if="connectionStatus === 'connecting'" class="text-yellow-400">
          Isaac Sim 연결 중...
        </span>
        <span v-else-if="connectionStatus === 'error'" class="text-red-400">
          {{ errorMessage || '연결 실패' }}
          <button @click="retryConnection" class="ml-2 underline hover:text-red-300">재시도</button>
        </span>
      </div>

      <!-- 설정 정보 표시 -->
      <div v-if="config && (status === 'configured' || status === 'running')" class="mt-2 text-xs text-gray-500">
        <span v-if="config.width && config.height">{{ config.width }}m x {{ config.height }}m</span>
        <span v-if="config.robots" class="ml-2">로봇 {{ config.robots }}대</span>
      </div>

      <!-- Mock 모드 표시 -->
      <div v-if="!streamUrl" class="absolute bottom-2 left-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
        Mock 모드
      </div>
    </div>

    <!-- 연결 상태 배지 -->
    <div
      v-if="streamUrl"
      class="absolute top-2 right-2 px-2 py-1 rounded text-xs"
      :class="{
        'bg-green-500/20 text-green-400': connectionStatus === 'connected',
        'bg-yellow-500/20 text-yellow-400': connectionStatus === 'connecting',
        'bg-red-500/20 text-red-400': connectionStatus === 'error',
        'bg-gray-500/20 text-gray-400': connectionStatus === 'disconnected'
      }"
    >
      {{
        connectionStatus === 'connected' ? 'Live' :
        connectionStatus === 'connecting' ? '연결 중...' :
        connectionStatus === 'error' ? '연결 실패' : '대기'
      }}
    </div>

    <!-- 로딩 오버레이 -->
    <div v-if="isLoading && connectionStatus === 'connecting'" class="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p class="text-sm text-gray-400">Isaac Sim 연결 중...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes moveRobot1 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(40px, 20px); }
  50% { transform: translate(60px, -10px); }
  75% { transform: translate(20px, -20px); }
}

@keyframes moveRobot2 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-30px, 30px); }
  50% { transform: translate(-20px, -20px); }
  75% { transform: translate(30px, 10px); }
}

@keyframes moveRobot3 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(25px, -25px); }
  50% { transform: translate(-35px, 15px); }
  75% { transform: translate(10px, 35px); }
}

@keyframes moveRobot4 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-20px, -30px); }
  50% { transform: translate(30px, 20px); }
  75% { transform: translate(-10px, 10px); }
}

@keyframes moveRobot5 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(35px, 15px); }
  50% { transform: translate(-25px, -25px); }
  75% { transform: translate(15px, -15px); }
}
</style>
