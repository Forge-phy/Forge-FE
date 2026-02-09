<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getStats, getApiStatus, getLSTMStatus } from '@/api/forge'

interface Stat {
  label: string
  value: string
  change: string
  icon: string
  color: string
}

interface Simulation {
  id: number
  name: string
  status: 'completed' | 'running' | 'pending'
  date: string
  progress: number
}

const stats = ref<Stat[]>([
  { label: '총 시뮬레이션', value: '-', change: '로딩 중...', icon: 'cube', color: 'indigo' },
  { label: 'LSTM 모델', value: '-', change: '확인 중...', icon: 'chip', color: 'emerald' },
  { label: '학습된 예시', value: '-', change: '로딩 중...', icon: 'chart', color: 'amber' },
  { label: '피드백', value: '-', change: '로딩 중...', icon: 'document', color: 'purple' },
])

const recentSimulations = ref<Simulation[]>([])
const isLoading = ref(true)
const apiConnected = ref(false)
const quickInput = ref('')

const statusLabels: Record<string, string> = {
  completed: '완료',
  running: '실행 중',
  pending: '대기 중',
}

// API에서 데이터 로드
onMounted(async () => {
  try {
    // API 상태 확인
    const apiStatus = await getApiStatus()
    apiConnected.value = apiStatus.status === 'running'

    // 통계 로드
    const statsData = await getStats()

    // LSTM 상태 확인
    const lstmStatus = await getLSTMStatus()

    // 통계 업데이트
    stats.value = [
      {
        label: '문서',
        value: String(statsData.documents),
        change: 'RAG 문서',
        icon: 'cube',
        color: 'indigo'
      },
      {
        label: 'LSTM 모델',
        value: lstmStatus.model_loaded ? 'Active' : 'Fallback',
        change: lstmStatus.mode,
        icon: 'chip',
        color: lstmStatus.model_loaded ? 'emerald' : 'amber'
      },
      {
        label: '학습된 예시',
        value: String(statsData.good_examples),
        change: 'RAG 학습',
        icon: 'chart',
        color: 'amber'
      },
      {
        label: '피드백',
        value: String(statsData.feedback_count),
        change: '누적',
        icon: 'document',
        color: 'purple'
      },
    ]

    // 최근 시뮬레이션 (현재 세션 기반)
    const today = new Date().toISOString().split('T')[0] as string
    if (statsData.current_session.has_config) {
      recentSimulations.value = [
        {
          id: 1,
          name: (statsData.current_session.last_input as string) || '현재 시뮬레이션',
          status: 'completed',
          date: today,
          progress: 100,
        }
      ]
    } else {
      // 샘플 데이터 표시
      recentSimulations.value = [
        {
          id: 1,
          name: '새 시뮬레이션을 시작해보세요',
          status: 'pending',
          date: today,
          progress: 0,
        }
      ]
    }

  } catch (error) {
    console.error('API 연결 실패:', error)
    apiConnected.value = false

    stats.value = [
      { label: '상태', value: 'Offline', change: '서버 연결 필요', icon: 'cube', color: 'red' },
      { label: 'LSTM 모델', value: '-', change: '연결 필요', icon: 'chip', color: 'gray' },
      { label: '학습된 예시', value: '-', change: '연결 필요', icon: 'chart', color: 'gray' },
      { label: '피드백', value: '-', change: '연결 필요', icon: 'document', color: 'gray' },
    ]

    recentSimulations.value = [
      {
        id: 1,
        name: '백엔드 서버를 시작해주세요',
        status: 'pending',
        date: '-',
        progress: 0,
      }
    ]
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Welcome Section -->
    <div
      class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-8"
    >
      <div class="relative z-10">
        <div class="flex items-center gap-2">
          <h2 class="text-2xl font-bold">안녕하세요, 사용자님</h2>
          <span
            :class="[
              'px-2 py-0.5 rounded text-xs',
              apiConnected ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
            ]"
          >
            {{ apiConnected ? 'API 연결됨' : 'API 오프라인' }}
          </span>
        </div>
        <p class="text-white/70 mt-2 max-w-lg">
          Forge v2.0으로 Isaac Sim 시뮬레이션을 쉽게 설정하고, AI 기반 갭 예측으로 현장 적용 불안을
          해소하세요.
        </p>
        <RouterLink
          to="/simulation"
          class="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-medium hover:bg-white/90 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          새 시뮬레이션 시작
        </RouterLink>
      </div>
      <!-- Decorative elements -->
      <div
        class="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
      ></div>
      <div
        class="absolute right-20 bottom-0 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl"
      ></div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="group relative bg-[#12121a] rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden"
      >
        <!-- Background glow on hover -->
        <div
          :class="[
            'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            stat.color === 'indigo'
              ? 'bg-indigo-500/5'
              : stat.color === 'emerald'
                ? 'bg-emerald-500/5'
                : stat.color === 'amber'
                  ? 'bg-amber-500/5'
                  : stat.color === 'purple'
                    ? 'bg-purple-500/5'
                    : stat.color === 'red'
                      ? 'bg-red-500/5'
                      : 'bg-gray-500/5',
          ]"
        ></div>

        <div class="relative flex items-start justify-between">
          <div>
            <p class="text-gray-400 text-sm">{{ stat.label }}</p>
            <p
              class="text-3xl font-bold mt-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent"
            >
              {{ stat.value }}
            </p>
            <p class="text-sm text-gray-500 mt-1">{{ stat.change }}</p>
          </div>
          <div
            :class="[
              'w-12 h-12 rounded-xl flex items-center justify-center',
              stat.color === 'indigo'
                ? 'bg-indigo-500/10 text-indigo-400'
                : stat.color === 'emerald'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : stat.color === 'amber'
                    ? 'bg-amber-500/10 text-amber-400'
                    : stat.color === 'purple'
                      ? 'bg-purple-500/10 text-purple-400'
                      : stat.color === 'red'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-gray-500/10 text-gray-400',
            ]"
          >
            <svg
              v-if="stat.icon === 'cube'"
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <svg
              v-if="stat.icon === 'chip'"
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
            <svg
              v-if="stat.icon === 'chart'"
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            <svg
              v-if="stat.icon === 'document'"
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent Simulations -->
      <div class="lg:col-span-2 bg-[#12121a] rounded-2xl border border-white/5 overflow-hidden">
        <div class="p-5 border-b border-white/5 flex items-center justify-between">
          <h3 class="font-semibold">최근 시뮬레이션</h3>
          <RouterLink
            to="/simulation"
            class="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            새로 시작
          </RouterLink>
        </div>
        <div v-if="isLoading" class="p-8 text-center text-gray-500">
          <div class="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          로딩 중...
        </div>
        <div v-else class="divide-y divide-white/5">
          <div
            v-for="sim in recentSimulations"
            :key="sim.id"
            class="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer group"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <div
                :class="[
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  sim.status === 'completed'
                    ? 'bg-emerald-500/10'
                    : sim.status === 'running'
                      ? 'bg-amber-500/10'
                      : 'bg-gray-500/10',
                ]"
              >
                <svg
                  v-if="sim.status === 'completed'"
                  class="w-5 h-5 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <svg
                  v-else-if="sim.status === 'running'"
                  class="w-5 h-5 text-amber-400 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <svg
                  v-else
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ sim.name }}</p>
                <div class="flex items-center gap-3 mt-1">
                  <p class="text-sm text-gray-500">{{ sim.date }}</p>
                  <div v-if="sim.status === 'running'" class="flex-1 max-w-32">
                    <div class="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                        :style="{ width: sim.progress + '%' }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-medium shrink-0',
                sim.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : sim.status === 'running'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-white/5 text-gray-400 border border-white/10',
              ]"
            >
              {{ statusLabels[sim.status] }}
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Chat -->
      <div class="bg-[#12121a] rounded-2xl border border-white/5 flex flex-col overflow-hidden">
        <div class="p-5 border-b border-white/5 flex items-center gap-2">
          <div
            :class="[
              'w-2 h-2 rounded-full',
              apiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
            ]"
          ></div>
          <h3 class="font-semibold">Forge AI</h3>
          <span class="text-xs text-gray-500 ml-auto">{{ apiConnected ? 'Qwen 모델' : '오프라인' }}</span>
        </div>
        <div class="flex-1 p-5 space-y-3">
          <div class="bg-white/5 rounded-xl p-4 text-sm border border-white/5">
            <p class="text-gray-400 text-xs mb-2">예시 명령어</p>
            <p class="text-gray-200">"30m x 20m 창고에 AGV 3대 배치"</p>
          </div>
          <div
            class="bg-gradient-to-r from-indigo-600/10 to-purple-600/10 rounded-xl p-4 text-sm border border-indigo-500/20"
          >
            <div class="flex items-center gap-2 mb-2">
              <div
                class="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <span class="text-xs text-indigo-400">Forge AI</span>
            </div>
            <p class="text-gray-300">
              시뮬레이션 환경을 자연어로 설명해주세요. Isaac Sim 파라미터로 자동 변환해드립니다.
            </p>
          </div>
        </div>
        <div class="p-4 border-t border-white/5">
          <RouterLink to="/simulation" class="block">
            <div class="flex gap-2">
              <input
                v-model="quickInput"
                type="text"
                placeholder="환경 설정 입력..."
                class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all placeholder-gray-500"
                readonly
              />
              <button
                class="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl transition-all"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
