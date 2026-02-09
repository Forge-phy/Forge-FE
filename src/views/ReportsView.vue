<script setup lang="ts">
import { ref } from 'vue'

const selectedReport = ref<number | null>(null)

const reports = ref([
  {
    id: 1,
    name: '물류 창고 AGV 시뮬레이션 결과 리포트',
    date: '2026-02-03',
    status: 'completed'
  },
  {
    id: 2,
    name: '제조 라인 로봇암 테스트 리포트',
    date: '2026-02-02',
    status: 'completed'
  },
  {
    id: 3,
    name: '자율주행 로봇 충돌 테스트 리포트',
    date: '2026-02-01',
    status: 'generating'
  }
])

const reportContent = `
# 시뮬레이션 결과 분석 리포트

**프로젝트**: 물류 창고 AGV 시뮬레이션
**생성일**: 2026-02-03
**신뢰도**: 89%

---

## 1. 요약

시뮬레이션 결과 100개/h이나, 현장 예상은 **83~87개/h**입니다.

| 항목 | 시뮬레이션 | 현장 예상 | 갭 |
|------|-----------|----------|-----|
| 처리량 | 100개/h | 85개/h | -15% |
| 충돌 | 1회 | 예상 2~3회 | +100% |

---

## 2. Sim2Real 갭 분석

### 주요 갭 요인
- **온도**: 현장 32°C (시뮬 25°C 대비 +7°C)
- **습도**: 현장 80% (시뮬 50% 대비 +30%)
- **바닥 마찰**: 현장 마찰계수 0.8 (시뮬 0.6 대비 +33%)

### 예측 모델
- 모델: LSTM (시계열 예측)
- 학습 데이터: 과거 6개월 현장 로그
- 신뢰구간: 95%

---

## 3. 이벤트 분석

### 충돌 이벤트 (00:03:21)
- **위치**: 교차로 (15, 10)
- **관련 로봇**: 1번, 2번
- **원인**: 동시 진입

### 권장 조치
1. 로봇 2번 출발 1.5초 지연
2. 교차로 신호 체계 도입

---

## 4. 권장사항

1. **생산계획**: 85개 기준으로 수립
2. **환경 개선**: 환기 시스템 점검
3. **경로 최적화**: 교차로 신호 체계 도입 검토

---

*이 리포트는 Forge v2.0의 LSTM + LLM 파이프라인으로 자동 생성되었습니다.*
`
</script>

<template>
  <div class="h-full flex gap-6">
    <!-- Report List -->
    <div class="w-80 bg-gray-800 rounded-xl border border-gray-700 flex flex-col">
      <div class="p-4 border-b border-gray-700">
        <h3 class="font-semibold">리포트 목록</h3>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div
          v-for="report in reports"
          :key="report.id"
          @click="selectedReport = report.id"
          :class="[
            'p-4 border-b border-gray-700 cursor-pointer transition-colors',
            selectedReport === report.id ? 'bg-indigo-600/20 border-l-2 border-l-indigo-500' : 'hover:bg-gray-700/50'
          ]"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ report.name }}</p>
              <p class="text-sm text-gray-400 mt-1">{{ report.date }}</p>
            </div>
            <span
              v-if="report.status === 'generating'"
              class="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded"
            >
              생성 중
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Report Content -->
    <div class="flex-1 bg-gray-800 rounded-xl border border-gray-700 flex flex-col">
      <div class="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 class="font-semibold">리포트 내용</h3>
        <div class="flex gap-2">
          <button class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
            PDF 다운로드
          </button>
          <button class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm transition-colors">
            공유
          </button>
        </div>
      </div>

      <div v-if="selectedReport" class="flex-1 overflow-y-auto p-6">
        <div class="prose prose-invert prose-sm max-w-none">
          <div class="whitespace-pre-wrap text-gray-300 leading-relaxed font-mono text-sm bg-gray-900 rounded-lg p-6">
            {{ reportContent }}
          </div>
        </div>
      </div>

      <div v-else class="flex-1 flex items-center justify-center text-gray-500">
        <div class="text-center">
          <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>리포트를 선택하세요</p>
        </div>
      </div>
    </div>
  </div>
</template>
