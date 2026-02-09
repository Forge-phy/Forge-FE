<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { predictGap, generateReport, getLSTMStatus, type LSTMPrediction } from '@/api/forge'

interface AnalysisData {
  simulation: {
    name: string
    date: string
    duration: string
    throughput: number
    temperature: number
    humidity: number
    robotCount: number
    warehouseSize: number
  }
  prediction: {
    expectedThroughput: { min: number; max: number; avg: number }
    confidence: number
    gap: number
    factors: string[]
  } | null
  events: Array<{ time: string; type: string; description: string }>
}

const today = new Date().toISOString().split('T')[0] as string

const analysisData = ref<AnalysisData>({
  simulation: {
    name: '새 분석',
    date: today,
    duration: '-',
    throughput: 100,
    temperature: 25,
    humidity: 50,
    robotCount: 3,
    warehouseSize: 600
  },
  prediction: null,
  events: []
})

const llmAnalysis = ref('')
const isLoading = ref(false)
const lstmMode = ref('checking...')
const isPredicting = ref(false)
const isGeneratingReport = ref(false)

// 입력 폼
const inputForm = ref({
  throughput: 100,
  temperature: 25,
  humidity: 50,
  robotCount: 3,
  operationHours: 4,
  warehouseSize: 600
})

const eventTypeColors: Record<string, string> = {
  collision: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
  success: 'bg-green-500'
}

// LSTM 상태 확인
onMounted(async () => {
  try {
    const status = await getLSTMStatus()
    lstmMode.value = status.model_loaded ? 'LSTM Active' : 'Fallback Mode'
  } catch {
    lstmMode.value = 'Offline'
  }
})

// Gap 예측 실행
const runPrediction = async () => {
  isPredicting.value = true
  analysisData.value.events = []

  try {
    // 시뮬레이션 데이터 업데이트
    const currentDate = new Date().toISOString().split('T')[0] as string
    analysisData.value.simulation = {
      name: `${inputForm.value.warehouseSize}m² 창고 시뮬레이션`,
      date: currentDate,
      duration: `${inputForm.value.operationHours}시간`,
      throughput: inputForm.value.throughput,
      temperature: inputForm.value.temperature,
      humidity: inputForm.value.humidity,
      robotCount: inputForm.value.robotCount,
      warehouseSize: inputForm.value.warehouseSize
    }

    // 이벤트 추가
    analysisData.value.events.push({
      time: new Date().toLocaleTimeString(),
      type: 'info',
      description: 'LSTM 갭 예측 시작...'
    })

    // LSTM 예측 호출
    const response = await predictGap({
      sim_throughput: inputForm.value.throughput,
      temperature: inputForm.value.temperature,
      humidity: inputForm.value.humidity,
      robot_count: inputForm.value.robotCount,
      operation_hours: inputForm.value.operationHours,
      warehouse_size: inputForm.value.warehouseSize
    })

    const prediction = response.prediction

    // 예측 결과 업데이트
    analysisData.value.prediction = {
      expectedThroughput: {
        min: prediction.confidence_interval[0],
        max: prediction.confidence_interval[1],
        avg: prediction.predicted_real_throughput
      },
      confidence: Math.round(prediction.confidence * 100),
      gap: Math.abs(prediction.gap_percent),
      factors: prediction.factors
    }

    // 이벤트 추가
    analysisData.value.events.push({
      time: new Date().toLocaleTimeString(),
      type: 'success',
      description: `예측 완료 (${response.mode} 모드)`
    })

    // 경고 이벤트 추가
    if (prediction.gap_percent < -15) {
      analysisData.value.events.push({
        time: new Date().toLocaleTimeString(),
        type: 'warning',
        description: `높은 갭 예측: ${prediction.gap_percent.toFixed(1)}%`
      })
    }

    // LLM 분석 텍스트 생성
    llmAnalysis.value = generateAnalysisText(prediction)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    analysisData.value.events.push({
      time: new Date().toLocaleTimeString(),
      type: 'collision',
      description: `예측 실패: ${errorMessage}`
    })
    llmAnalysis.value = `## 오류 발생\n\n예측을 수행할 수 없습니다.\n\n**원인**: ${errorMessage}\n\n백엔드 서버가 실행 중인지 확인해주세요.`
  } finally {
    isPredicting.value = false
  }
}

// LLM 보고서 생성
const generateFullReport = async () => {
  if (!analysisData.value.prediction) return

  isGeneratingReport.value = true

  try {
    const lstmResult: LSTMPrediction = {
      sim_throughput: inputForm.value.throughput,
      predicted_real_throughput: analysisData.value.prediction.expectedThroughput.avg,
      gap_percent: -analysisData.value.prediction.gap,
      confidence: analysisData.value.prediction.confidence / 100,
      confidence_interval: [
        analysisData.value.prediction.expectedThroughput.min,
        analysisData.value.prediction.expectedThroughput.max
      ],
      factors: analysisData.value.prediction.factors
    }

    const response = await generateReport(lstmResult, {
      environment: {
        type: 'warehouse',
        width: Math.sqrt(inputForm.value.warehouseSize),
        length: Math.sqrt(inputForm.value.warehouseSize)
      },
      robots: [{ type: 'AGV', count: inputForm.value.robotCount }],
      temperature: inputForm.value.temperature,
      humidity: inputForm.value.humidity
    })

    // 보고서 내용 업데이트
    if (response.report.summary) {
      llmAnalysis.value = response.report.summary
    } else if (response.report.executive_summary) {
      llmAnalysis.value = response.report.executive_summary
    }

    analysisData.value.events.push({
      time: new Date().toLocaleTimeString(),
      type: 'success',
      description: 'LLM 보고서 생성 완료'
    })

  } catch (error) {
    analysisData.value.events.push({
      time: new Date().toLocaleTimeString(),
      type: 'warning',
      description: 'LLM 보고서 생성 실패 (기본 분석 유지)'
    })
  } finally {
    isGeneratingReport.value = false
  }
}

// 분석 텍스트 생성 (로컬)
const generateAnalysisText = (prediction: LSTMPrediction): string => {
  const gapDirection = prediction.gap_percent < 0 ? '감소' : '증가'
  const gapAbs = Math.abs(prediction.gap_percent).toFixed(1)

  return `## 시뮬레이션 결과 분석

### 주요 발견사항

1. **성능 갭 예측**: 시뮬레이션 결과 ${prediction.sim_throughput}개/h이나, 현장 예상은 ${prediction.confidence_interval[0]}~${prediction.confidence_interval[1]}개/h입니다.
   - 예상 갭: **${gapAbs}% ${gapDirection}**
   - 신뢰도: ${(prediction.confidence * 100).toFixed(0)}%

2. **주요 갭 요인**:
${prediction.factors.map(f => `   - ${f}`).join('\n')}

### 권장사항
- 생산계획은 **${Math.round(prediction.predicted_real_throughput)}개 기준**으로 수립하세요
${prediction.gap_percent < -10 ? '- 환경 조건 개선 검토 필요\n- 환기 시스템 점검 권장' : '- 현재 환경 조건은 양호합니다'}

### 다음 단계
"LLM 상세 보고서 생성" 버튼을 클릭하여 더 자세한 분석을 받아보세요.`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold">결과 분석</h2>
        <p class="text-gray-400 mt-1">{{ analysisData.simulation.name }}</p>
      </div>
      <div class="flex items-center gap-3">
        <span
          :class="[
            'px-3 py-1 rounded-lg text-xs font-medium',
            lstmMode.includes('Active') ? 'bg-green-500/20 text-green-400' :
            lstmMode.includes('Fallback') ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          ]"
        >
          {{ lstmMode }}
        </span>
        <button
          v-if="analysisData.prediction"
          @click="generateFullReport"
          :disabled="isGeneratingReport"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {{ isGeneratingReport ? '생성 중...' : 'LLM 상세 보고서' }}
        </button>
      </div>
    </div>

    <!-- Input Form -->
    <div class="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <h3 class="font-semibold mb-4">예측 파라미터</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div>
          <label class="text-xs text-gray-400 block mb-1">시뮬 처리량 (개/h)</label>
          <input
            v-model.number="inputForm.throughput"
            type="number"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">온도 (°C)</label>
          <input
            v-model.number="inputForm.temperature"
            type="number"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">습도 (%)</label>
          <input
            v-model.number="inputForm.humidity"
            type="number"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">로봇 수</label>
          <input
            v-model.number="inputForm.robotCount"
            type="number"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">가동 시간 (h)</label>
          <input
            v-model.number="inputForm.operationHours"
            type="number"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">창고 크기 (m²)</label>
          <input
            v-model.number="inputForm.warehouseSize"
            type="number"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <button
        @click="runPrediction"
        :disabled="isPredicting"
        class="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
      >
        {{ isPredicting ? '예측 중...' : 'Gap 예측 실행' }}
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p class="text-gray-400 text-sm">시뮬레이션 처리량</p>
        <p class="text-3xl font-bold mt-2">{{ analysisData.simulation.throughput }}<span class="text-lg text-gray-400">/h</span></p>
      </div>
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p class="text-gray-400 text-sm">예상 현장 처리량</p>
        <p v-if="analysisData.prediction" class="text-3xl font-bold mt-2 text-yellow-400">
          {{ analysisData.prediction.expectedThroughput.avg }}<span class="text-lg text-gray-400">/h</span>
        </p>
        <p v-else class="text-3xl font-bold mt-2 text-gray-500">-</p>
        <p v-if="analysisData.prediction" class="text-xs text-gray-500 mt-1">
          {{ analysisData.prediction.expectedThroughput.min }}~{{ analysisData.prediction.expectedThroughput.max }}
        </p>
      </div>
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p class="text-gray-400 text-sm">예상 갭</p>
        <p v-if="analysisData.prediction" class="text-3xl font-bold mt-2 text-red-400">
          {{ analysisData.prediction.gap.toFixed(1) }}%
        </p>
        <p v-else class="text-3xl font-bold mt-2 text-gray-500">-</p>
      </div>
      <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p class="text-gray-400 text-sm">신뢰도</p>
        <p v-if="analysisData.prediction" class="text-3xl font-bold mt-2 text-green-400">
          {{ analysisData.prediction.confidence }}%
        </p>
        <p v-else class="text-3xl font-bold mt-2 text-gray-500">-</p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- LLM Analysis -->
      <div class="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700">
        <div class="p-5 border-b border-gray-700 flex items-center justify-between">
          <h3 class="font-semibold">AI 분석 결과</h3>
          <span class="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">LSTM + LLM</span>
        </div>
        <div class="p-5">
          <div v-if="llmAnalysis" class="prose prose-invert prose-sm max-w-none">
            <div class="whitespace-pre-wrap text-gray-300 leading-relaxed" v-html="llmAnalysis.replace(/\n/g, '<br>').replace(/##\s/g, '<h3 class=\'text-lg font-semibold text-white mt-4 mb-2\'>').replace(/###\s/g, '<h4 class=\'text-md font-medium text-white mt-3 mb-1\'>').replace(/\*\*(.*?)\*\*/g, '<strong class=\'text-white\'>$1</strong>')">
            </div>
          </div>
          <div v-else class="text-center text-gray-500 py-12">
            <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>"Gap 예측 실행" 버튼을 클릭하여 분석을 시작하세요</p>
          </div>
        </div>
      </div>

      <!-- Events & Factors -->
      <div class="space-y-4">
        <!-- Gap Factors -->
        <div class="bg-gray-800 rounded-xl border border-gray-700">
          <div class="p-4 border-b border-gray-700">
            <h3 class="font-semibold">갭 요인 (LSTM)</h3>
          </div>
          <div class="p-4">
            <div v-if="analysisData.prediction?.factors.length" class="space-y-2">
              <div
                v-for="factor in analysisData.prediction.factors"
                :key="factor"
                class="flex items-center gap-2 text-sm"
              >
                <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>{{ factor }}</span>
              </div>
            </div>
            <p v-else class="text-sm text-gray-500">예측 실행 후 표시됩니다</p>
          </div>
        </div>

        <!-- Events Timeline -->
        <div class="bg-gray-800 rounded-xl border border-gray-700">
          <div class="p-4 border-b border-gray-700">
            <h3 class="font-semibold">이벤트 타임라인</h3>
          </div>
          <div class="p-4">
            <div v-if="analysisData.events.length" class="space-y-3">
              <div
                v-for="(event, index) in analysisData.events"
                :key="index"
                class="flex gap-3"
              >
                <div :class="[eventTypeColors[event.type] || 'bg-gray-500', 'w-2 h-2 rounded-full mt-1.5']"></div>
                <div class="flex-1">
                  <p class="text-sm">{{ event.description }}</p>
                  <p class="text-xs text-gray-500">{{ event.time }}</p>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-gray-500">이벤트가 없습니다</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
