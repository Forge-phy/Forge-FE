<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  parseEnvironment,
  modifyParameters,
  runPipeline,
  getIsaacSimStatus,
  startSimulation as startIsaacSimulation,
  stopSimulation as stopIsaacSimulation,
  type SecurityMode
} from '@/api/forge'
import WarehouseViewer from '@/components/WarehouseViewer.vue'
import IsaacSimStreamViewer from '@/components/IsaacSimStreamViewer.vue'

// 뷰어 모드: 'stream' (Isaac Sim 실시간) | 'preview' (Three.js 3D)
const viewerMode = ref<'stream' | 'preview'>('stream')

// 전체 화면 모드
const isFullscreen = ref(false)
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

interface Message {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  data?: Record<string, unknown>
}

const messages = ref<Message[]>([
  {
    id: 1,
    role: 'assistant',
    content: '안녕하세요! Forge AI입니다. 시뮬레이션 환경을 자연어로 설명해주세요.\n\n예시: "30m x 20m 물류 창고, AGV 3대, 선반 2열 배치"\n\n설정 완료 후 수정도 가능합니다: "로봇 5대로 늘려줘", "창고 크기 50x30으로 변경"',
    timestamp: new Date()
  }
])

const inputMessage = ref('')
const isLoading = ref(false)
const isConnected = ref(false)
const connectionMode = ref('checking...')

// 보안 모드 (기본: fast - 외부 API)
const securityMode = ref<SecurityMode>('fast')

const simulationParams = ref({
  width: 0,
  height: 0,
  robots: 0,
  shelves: 0,
  temperature: 25,
  humidity: 50,
  status: 'ready' as 'ready' | 'configured' | 'running' | 'completed' | 'error'
})

const currentConfig = ref<Record<string, unknown> | null>(null)
const pipelineResult = ref<Record<string, unknown> | null>(null)
const streamUrl = ref<string | null>(null)

// Isaac Sim 연결 상태 확인
onMounted(async () => {
  try {
    const status = await getIsaacSimStatus()
    isConnected.value = status.connected
    connectionMode.value = status.mode
    streamUrl.value = status.stream_url || null
  } catch (e) {
    isConnected.value = false
    connectionMode.value = 'offline'
    streamUrl.value = null
  }
})

// v2.1: 수정 요청 의도 감지
const isModifyRequest = (text: string): boolean => {
  const modifyKeywords = [
    '변경', '수정', '바꿔', '늘려', '줄여', '추가', '삭제', '제거',
    '올려', '내려', '키워', '줄이', '더', '덜', '로 해줘', '으로 해줘',
    'change', 'modify', 'update', 'add', 'remove', 'increase', 'decrease'
  ]
  const textLower = text.toLowerCase()
  return modifyKeywords.some(kw => textLower.includes(kw))
}

const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return

  const userMessage: Message = {
    id: messages.value.length + 1,
    role: 'user',
    content: inputMessage.value,
    timestamp: new Date()
  }
  messages.value.push(userMessage)
  const userInput = inputMessage.value
  inputMessage.value = ''
  isLoading.value = true

  try {
    let response

    // v2.1: 이전 설정이 있고 수정 요청이면 modifyParameters 호출
    if (currentConfig.value && isModifyRequest(userInput)) {
      messages.value.push({
        id: messages.value.length + 1,
        role: 'system',
        content: '기존 설정을 수정 중...',
        timestamp: new Date()
      })

      response = await modifyParameters(currentConfig.value, userInput, securityMode.value)
    } else {
      // 새로운 환경 설정
      response = await parseEnvironment(userInput, true, securityMode.value)
    }

    // 파라미터 추출
    const params = response.parameters
    const env = params.environment || {}
    const robots = params.robots || []
    const robotCount = robots.reduce((sum: number, r: { count?: number }) => sum + (r.count || 1), 0)

    // 이전 값과 비교하여 변경 사항 표시
    const changes: string[] = []
    if (currentConfig.value) {
      const prevEnv = (currentConfig.value as { environment?: { width?: number; length?: number } }).environment || {}
      const prevRobots = (currentConfig.value as { robots?: Array<{ count?: number }> }).robots || []
      const prevRobotCount = prevRobots.reduce((sum: number, r: { count?: number }) => sum + (r.count || 1), 0)

      if (prevEnv.width !== env.width || prevEnv.length !== env.length) {
        changes.push(`창고 크기: ${prevEnv.width || 0}x${prevEnv.length || 0} → ${env.width || 0}x${env.length || 0}`)
      }
      if (prevRobotCount !== robotCount) {
        changes.push(`로봇 대수: ${prevRobotCount}대 → ${robotCount}대`)
      }
    }

    simulationParams.value = {
      width: env.width || 30,
      height: env.length || 20,
      robots: robotCount,
      shelves: 2,
      temperature: 25,
      humidity: 50,
      status: 'configured'
    }

    currentConfig.value = params

    // 응답 메시지 생성
    let responseContent = ''

    if (changes.length > 0) {
      responseContent = `설정이 수정되었습니다.\n\n**변경 사항:**\n${changes.map(c => `- ${c}`).join('\n')}\n\n`
    } else {
      responseContent = `환경 설정을 분석했습니다.\n\n`
    }

    responseContent += `**현재 파라미터:**\n`
    responseContent += `- 창고 크기: ${simulationParams.value.width}m x ${simulationParams.value.height}m\n`
    responseContent += `- 로봇 대수: ${simulationParams.value.robots}대\n`
    responseContent += `- 사용 모델: ${response.provider}\n`
    responseContent += `- 보안 모드: ${securityMode.value === 'secure' ? '로컬 처리' : '외부 API'}`

    if (response.sensitivity_detail) {
      responseContent += `\n- 보안 분류: ${response.sensitivity} (${response.sensitivity_detail.reason})`
    }

    responseContent += `\n\n수정이 필요하면 "로봇 3대로 줄여줘" 처럼 말씀하세요.\n준비되면 "시뮬레이션 시작" 버튼을 클릭하세요.`

    const assistantMessage: Message = {
      id: messages.value.length + 1,
      role: 'assistant',
      content: responseContent,
      timestamp: new Date(),
      data: params
    }
    messages.value.push(assistantMessage)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'

    messages.value.push({
      id: messages.value.length + 1,
      role: 'system',
      content: `오류가 발생했습니다: ${errorMessage}\n\n백엔드 서버가 실행 중인지 확인해주세요.`,
      timestamp: new Date()
    })

    simulationParams.value.status = 'error'
  } finally {
    isLoading.value = false
  }
}

const startSimulation = async () => {
  if (!currentConfig.value) return

  simulationParams.value.status = 'running'
  isLoading.value = true

  messages.value.push({
    id: messages.value.length + 1,
    role: 'system',
    content: '시뮬레이션을 시작합니다...',
    timestamp: new Date()
  })

  try {
    const prompt = `${simulationParams.value.width}m x ${simulationParams.value.height}m 창고, 로봇 ${simulationParams.value.robots}대`
    const response = await runPipeline(prompt)

    pipelineResult.value = response.result as unknown as Record<string, unknown>

    // Isaac Sim 로봇 움직임 시작
    try {
      const isaacResult = await startIsaacSimulation()
      console.log('Isaac Sim 로봇 움직임:', isaacResult)
    } catch (isaacError) {
      console.warn('Isaac Sim 로봇 움직임 시작 실패:', isaacError)
    }

    simulationParams.value.status = 'completed'

    const result = response.result
    let resultMessage = '시뮬레이션이 완료되었습니다.\n\n'

    if (result.simulation_result) {
      resultMessage += `**시뮬레이션 결과:**\n`
      resultMessage += `- 처리량: ${result.simulation_result.total_throughput}개/시간\n`
      resultMessage += `- 충돌: ${result.simulation_result.total_collisions}회\n`
      resultMessage += `- 총 처리: ${result.simulation_result.total_items_processed}개\n\n`
    }

    if (result.gap_prediction) {
      resultMessage += `**Gap 예측 (LSTM):**\n`
      resultMessage += `- 예상 Gap: ${result.gap_prediction.predicted_gap_percent}%\n`
      resultMessage += `- 예상 현장 처리량: ${result.gap_prediction.predicted_real_throughput}개/시간\n`
      resultMessage += `- 신뢰도: ${(result.gap_prediction.confidence_score * 100).toFixed(0)}%\n\n`
    }

    if (result.report?.summary) {
      resultMessage += `**보고서 요약:**\n${result.report.summary.substring(0, 300)}...`
    }

    messages.value.push({
      id: messages.value.length + 1,
      role: 'assistant',
      content: resultMessage,
      timestamp: new Date(),
      data: result as unknown as Record<string, unknown>
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    simulationParams.value.status = 'error'

    messages.value.push({
      id: messages.value.length + 1,
      role: 'system',
      content: `시뮬레이션 실행 중 오류: ${errorMessage}`,
      timestamp: new Date()
    })
  } finally {
    isLoading.value = false
  }
}

const resetSimulation = () => {
  simulationParams.value = {
    width: 0,
    height: 0,
    robots: 0,
    shelves: 0,
    temperature: 25,
    humidity: 50,
    status: 'ready'
  }
  currentConfig.value = null
  pipelineResult.value = null
}
</script>

<template>
  <div class="h-full min-h-0 flex flex-col lg:flex-row gap-4 p-2">
    <!-- Chat Panel -->
    <div class="lg:w-[400px] xl:w-[450px] flex flex-col bg-gray-800 rounded-xl border border-gray-700 min-h-[300px] lg:min-h-0" :class="{ 'hidden': isFullscreen }">
      <div class="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 class="font-semibold">환경 설정 (LLM)</h3>
        <div class="flex items-center gap-4">
          <!-- v2.1: 보안 모드 선택 -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">보안:</span>
            <select
              v-model="securityMode"
              class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="secure">로컬 (보안)</option>
              <option value="fast">외부 API (빠름)</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <span
              :class="[
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-400' : 'bg-yellow-400'
              ]"
            ></span>
            <span class="text-xs text-gray-400">{{ connectionMode }}</span>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div
          v-for="message in messages"
          :key="message.id"
          :class="[
            'max-w-[85%] rounded-lg p-4',
            message.role === 'user'
              ? 'ml-auto bg-indigo-600'
              : message.role === 'system'
                ? 'bg-yellow-600/20 border border-yellow-600/30'
                : 'bg-gray-700'
          ]"
        >
          <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
          <p class="text-xs text-gray-400 mt-2">
            {{ message.timestamp.toLocaleTimeString() }}
          </p>
        </div>

        <div v-if="isLoading" class="bg-gray-700 rounded-lg p-4 max-w-[80%]">
          <div class="flex gap-1">
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="p-4 border-t border-gray-700">
        <form @submit.prevent="sendMessage" class="flex gap-2">
          <input
            v-model="inputMessage"
            type="text"
            :placeholder="currentConfig ? '수정 요청 또는 새 환경 설정...' : '환경 설정을 자연어로 입력하세요...'"
            class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
            :disabled="isLoading"
          />
          <button
            type="submit"
            :disabled="isLoading"
            class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            전송
          </button>
        </form>
        <!-- 수정 힌트 -->
        <div v-if="currentConfig" class="mt-2 text-xs text-gray-500">
          현재 설정이 있습니다. "로봇 5대로 변경", "창고 크기 늘려줘" 등으로 수정 가능
        </div>
      </div>
    </div>

    <!-- Preview Panel -->
    <div class="flex-1 flex flex-col gap-3 min-h-0" :class="{ 'fixed inset-4 z-50 bg-gray-900': isFullscreen }">
      <!-- 뷰어 (탭 전환 방식) -->
      <div class="flex-1 min-h-[300px] bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
        <div class="p-3 border-b border-gray-700 flex items-center justify-between">
          <h3 class="font-semibold">시뮬레이션 뷰어</h3>
          <div class="flex items-center gap-3">
            <!-- 뷰어 모드 탭 -->
            <div class="flex bg-gray-700 rounded-lg p-0.5">
              <button
                @click="viewerMode = 'preview'"
                :class="[
                  'px-4 py-1.5 text-sm rounded transition-colors',
                  viewerMode === 'preview' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                ]"
              >
                3D Preview
              </button>
              <button
                @click="viewerMode = 'stream'"
                :class="[
                  'px-4 py-1.5 text-sm rounded transition-colors flex items-center gap-2',
                  viewerMode === 'stream' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                ]"
              >
                <span
                  :class="[
                    'w-2 h-2 rounded-full',
                    isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                  ]"
                ></span>
                Isaac Sim Live
              </button>
            </div>
            <!-- 전체 화면 버튼 -->
            <button
              @click="toggleFullscreen"
              class="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              :title="isFullscreen ? '전체 화면 종료' : '전체 화면'"
            >
              <svg v-if="!isFullscreen" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex-1 min-h-0">
          <!-- Three.js 3D Preview -->
          <WarehouseViewer
            v-if="viewerMode === 'preview'"
            :status="simulationParams.status"
            :config="{
              width: simulationParams.width || 30,
              length: simulationParams.height || 20,
              robots: simulationParams.robots || 3,
              shelves: simulationParams.shelves || 2
            }"
            class="w-full h-full"
          />
          <!-- Isaac Sim 실시간 스트리밍 -->
          <IsaacSimStreamViewer
            v-else
            server="43.203.146.84"
            :signaling-port="49100"
            :media-port="47998"
            :auto-connect="false"
            class="w-full h-full"
          />
        </div>
      </div>

      <!-- Parameters & Controls -->
      <div class="bg-gray-800 rounded-xl border border-gray-700 flex flex-col" :class="{ 'hidden': isFullscreen }">
        <div class="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 class="font-semibold">시뮬레이션 파라미터</h3>
          <span
            :class="[
              'px-2 py-0.5 rounded text-xs',
              simulationParams.status === 'ready' ? 'bg-gray-600' :
              simulationParams.status === 'configured' ? 'bg-yellow-500/20 text-yellow-400' :
              simulationParams.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
              simulationParams.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              'bg-red-500/20 text-red-400'
            ]"
          >
            {{
              simulationParams.status === 'ready' ? '대기' :
              simulationParams.status === 'configured' ? '설정 완료' :
              simulationParams.status === 'running' ? '실행 중' :
              simulationParams.status === 'completed' ? '완료' : '오류'
            }}
          </span>
        </div>
        <div class="flex-1 px-4 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 content-center">
          <div class="bg-gray-700/50 rounded-xl p-4 text-center border border-gray-600/50">
            <div class="text-gray-400 text-xs mb-2 uppercase tracking-wide">창고 크기</div>
            <div class="font-bold text-xl">
              <span v-if="simulationParams.width && simulationParams.height">
                {{ simulationParams.width }} x {{ simulationParams.height }}m
              </span>
              <span v-else class="text-gray-500">미설정</span>
            </div>
          </div>
          <div class="bg-gray-700/50 rounded-xl p-4 text-center border border-gray-600/50">
            <div class="text-gray-400 text-xs mb-2 uppercase tracking-wide">로봇 수</div>
            <div class="font-bold text-xl">
              <span v-if="simulationParams.robots" class="text-green-400">{{ simulationParams.robots }}대</span>
              <span v-else class="text-gray-500">미설정</span>
            </div>
          </div>
          <div class="bg-gray-700/50 rounded-xl p-4 text-center border border-gray-600/50">
            <div class="text-gray-400 text-xs mb-2 uppercase tracking-wide">온도</div>
            <div class="font-bold text-xl text-orange-400">{{ simulationParams.temperature }}°C</div>
          </div>
          <div class="bg-gray-700/50 rounded-xl p-4 text-center border border-gray-600/50">
            <div class="text-gray-400 text-xs mb-2 uppercase tracking-wide">습도</div>
            <div class="font-bold text-xl text-blue-400">{{ simulationParams.humidity }}%</div>
          </div>
          <div class="bg-gray-700/50 rounded-xl p-4 text-center border border-gray-600/50 col-span-2 md:col-span-1">
            <div class="text-gray-400 text-xs mb-2 uppercase tracking-wide">보안 모드</div>
            <div :class="securityMode === 'secure' ? 'text-green-400' : 'text-yellow-400'" class="font-bold text-xl">
              {{ securityMode === 'secure' ? '로컬' : '외부' }}
            </div>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-gray-700 flex flex-col sm:flex-row gap-3">
          <button
            @click="startSimulation"
            :disabled="simulationParams.status !== 'configured' || isLoading"
            class="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-base"
          >
            <svg v-if="simulationParams.status === 'running'" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ simulationParams.status === 'running' ? '실행 중...' : '시뮬레이션 시작' }}
          </button>
          <button
            v-if="simulationParams.status === 'completed' || simulationParams.status === 'error'"
            @click="resetSimulation"
            class="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
          >
            초기화
          </button>
        </div>
      </div>
    </div>

    <!-- 전체 화면 모드에서 ESC로 종료 안내 -->
    <div
      v-if="isFullscreen"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-800/90 text-gray-400 text-sm rounded-lg z-50"
    >
      전체 화면 모드 · 우측 상단 X 버튼으로 종료
    </div>
  </div>
</template>
