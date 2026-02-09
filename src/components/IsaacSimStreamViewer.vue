<script setup lang="ts">
/**
 * Isaac Sim WebRTC Stream Viewer
 * NVIDIA 공식 omniverse-webrtc-streaming-library 사용
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { AppStreamer, StreamType, type ApplicationMessage } from '@nvidia/omniverse-webrtc-streaming-library'

const props = defineProps<{
  server?: string
  signalingPort?: number
  mediaPort?: number
  autoConnect?: boolean
}>()

const emit = defineEmits<{
  (e: 'connected'): void
  (e: 'disconnected'): void
  (e: 'error', error: string): void
  (e: 'message', data: any): void
}>()

// 상태
const isConnected = ref(false)
const isConnecting = ref(false)
const errorMessage = ref('')
const streamInfo = ref<{ width: number; height: number; fps: number } | null>(null)

// DOM 요소 ID
const videoElementId = 'isaac-sim-video'
const audioElementId = 'isaac-sim-audio'

// 기본 서버 설정 (AWS EC2)
const serverConfig = {
  server: props.server || '43.203.146.84',
  signalingPort: props.signalingPort || 49100,
  mediaPort: props.mediaPort || 47998
}

// 스트림 연결
const connect = async () => {
  if (isConnecting.value || isConnected.value) return

  isConnecting.value = true
  errorMessage.value = ''

  try {
    console.log('Connecting to Isaac Sim:', serverConfig)

    await AppStreamer.connect({
      streamSource: StreamType.DIRECT,  // 'direct' for local/remote server
      streamConfig: {
        // 서버 설정
        signalingServer: serverConfig.server,
        signalingPort: serverConfig.signalingPort,
        mediaServer: serverConfig.server,
        mediaPort: serverConfig.mediaPort,

        // 비디오 설정
        width: 1920,
        height: 1080,
        fps: 60,

        // DOM 요소
        videoElementId: videoElementId,
        audioElementId: audioElementId,

        // 연결 옵션
        maxReconnects: 5,
        nativeTouchEvents: true,
        cursor: 'free',

        // 콜백
        onUpdate: (message: any) => {
          console.log('Stream update:', message)
        },
        onStart: (message: any) => {
          console.log('Stream started:', message)
          isConnected.value = true
          isConnecting.value = false
          streamInfo.value = {
            width: message.width || 1920,
            height: message.height || 1080,
            fps: message.fps || 60
          }
          emit('connected')
        },
        onCustomEvent: (event: any) => {
          console.log('Custom event:', event)
          emit('message', event)
        },
        onStop: () => {
          console.log('Stream stopped')
          isConnected.value = false
          emit('disconnected')
        },
        onTerminate: () => {
          console.log('Stream terminated')
          isConnected.value = false
          isConnecting.value = false
          emit('disconnected')
        }
      }
    })
  } catch (error) {
    console.error('Connection error:', error)
    isConnecting.value = false
    errorMessage.value = error instanceof Error ? error.message : '연결 실패'
    emit('error', errorMessage.value)
  }
}

// 연결 해제
const disconnect = () => {
  try {
    AppStreamer.stop()
    isConnected.value = false
    isConnecting.value = false
    emit('disconnected')
  } catch (error) {
    console.error('Disconnect error:', error)
  }
}

// 메시지 전송
const sendMessage = (eventType: string, payload: Record<string, unknown>) => {
  if (!isConnected.value) {
    console.warn('Not connected')
    return
  }

  try {
    const message: ApplicationMessage = {
      event_type: eventType,
      payload: payload
    }
    AppStreamer.sendMessage(message)
  } catch (error) {
    console.error('Send message error:', error)
  }
}

// 재연결
const reconnect = () => {
  disconnect()
  setTimeout(() => connect(), 500)
}

// 라이프사이클
onMounted(() => {
  if (props.autoConnect) {
    setTimeout(() => connect(), 1000)
  }
})

onUnmounted(() => {
  disconnect()
})

// props 변경 감지
watch(() => props.server, () => {
  if (props.server) {
    serverConfig.server = props.server
  }
})

// 외부에서 사용할 수 있도록 expose
defineExpose({
  connect,
  disconnect,
  sendMessage,
  reconnect,
  isConnected,
  isConnecting
})
</script>

<template>
  <div class="isaac-stream-viewer w-full h-full bg-gray-900 rounded-lg overflow-hidden relative">
    <!-- 비디오 요소 -->
    <video
      :id="videoElementId"
      autoplay
      playsinline
      muted
      class="w-full h-full object-contain bg-black"
      :class="{ 'opacity-0': !isConnected }"
    />

    <!-- 오디오 요소 (숨김) -->
    <audio :id="audioElementId" autoplay class="hidden" />

    <!-- 연결 대기 UI -->
    <div
      v-if="!isConnected"
      class="absolute inset-0 flex flex-col items-center justify-center bg-gray-900"
    >
      <!-- 연결 중 -->
      <div v-if="isConnecting" class="text-center">
        <div class="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-gray-400">Isaac Sim에 연결 중...</p>
        <p class="text-gray-500 text-sm mt-2">{{ serverConfig.server }}:{{ serverConfig.signalingPort }}</p>
      </div>

      <!-- 연결 전 / 에러 -->
      <div v-else class="text-center">
        <!-- Isaac Sim 아이콘 -->
        <svg class="w-20 h-20 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>

        <!-- 에러 메시지 -->
        <p v-if="errorMessage" class="text-red-400 mb-4">{{ errorMessage }}</p>
        <p v-else class="text-gray-500 mb-4">Isaac Sim 스트리밍 연결 대기</p>

        <!-- 연결 버튼 -->
        <button
          @click="connect"
          class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          연결하기
        </button>

        <!-- 서버 정보 -->
        <p class="text-gray-600 text-xs mt-4">
          Server: {{ serverConfig.server }}
        </p>
      </div>
    </div>

    <!-- 연결됨 상태 배지 -->
    <div
      v-if="isConnected"
      class="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 text-sm rounded-full"
    >
      <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
      Live
    </div>

    <!-- 스트림 정보 -->
    <div
      v-if="isConnected && streamInfo"
      class="absolute bottom-3 left-3 px-2 py-1 bg-black/50 text-gray-400 text-xs rounded"
    >
      {{ streamInfo.width }}x{{ streamInfo.height }} @ {{ streamInfo.fps }}fps
    </div>

    <!-- 컨트롤 버튼 -->
    <div
      v-if="isConnected"
      class="absolute bottom-3 right-3 flex gap-2"
    >
      <button
        @click="reconnect"
        class="p-2 bg-gray-800/80 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors"
        title="재연결"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
      <button
        @click="disconnect"
        class="p-2 bg-red-800/80 hover:bg-red-700 text-red-400 rounded-lg transition-colors"
        title="연결 해제"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.isaac-stream-viewer video {
  transition: opacity 0.3s ease;
}
</style>
