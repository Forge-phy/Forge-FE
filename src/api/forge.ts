/**
 * Forge API Client
 * 백엔드 FastAPI 서버와 통신
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============================================================
// Types
// ============================================================

// v2.1: 보안 모드
export type SecurityMode = 'secure' | 'fast'

export interface EnvironmentResponse {
  status: string
  provider: string
  sensitivity: string
  security_mode?: string
  parameters: {
    environment?: {
      type?: string
      width?: number
      length?: number
    }
    robots?: Array<{
      type: string
      count: number
      speed?: number
    }>
    simulation?: {
      duration?: number
    }
  }
  message: string
  sensitivity_detail?: {
    reason: string
    input_sensitivity: string
    context_sensitivity: string
  }
}

export interface LSTMPrediction {
  sim_throughput: number
  predicted_real_throughput: number
  gap_percent: number
  confidence: number
  confidence_interval: [number, number]
  factors: string[]
}

export interface LSTMResponse {
  status: string
  mode: 'lstm' | 'fallback'
  prediction: LSTMPrediction
}

export interface PipelineResult {
  success: boolean
  environment_config?: Record<string, unknown>
  simulation_config?: Record<string, unknown>
  simulation_result?: {
    total_throughput: number
    total_collisions: number
    total_items_processed: number
    robot_metrics: Array<Record<string, unknown>>
  }
  gap_prediction?: {
    predicted_gap_percent: number
    confidence_score: number
    confidence_interval: [number, number]
    predicted_real_throughput: number
    factors: Record<string, number>
  }
  report?: {
    summary: string
    recommendations: string[]
    warnings: string[]
  }
  error_message?: string
}

export interface StatsResponse {
  documents: number
  good_examples: number
  feedback_count: number
  current_session: {
    has_config: boolean
    last_input: string | null
  }
}

export interface ReportResponse {
  status: string
  provider: string
  sensitivity: string
  report: {
    summary?: string
    executive_summary?: string
    recommendations?: string[]
    warnings?: string[]
  }
}

// ============================================================
// API Functions
// ============================================================

/**
 * API 요청 헬퍼
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `API Error: ${response.status}`)
  }

  return response.json()
}

/**
 * 자연어 → Isaac Sim 환경 파라미터 변환 (v2.1 보안 우선)
 *
 * @param prompt - 자연어 요청
 * @param useRag - RAG 사용 여부
 * @param securityMode - 보안 모드: 'secure'(기본, 로컬) / 'fast'(외부 API)
 */
export async function parseEnvironment(
  prompt: string,
  useRag: boolean = true,
  securityMode: SecurityMode = 'secure'
): Promise<EnvironmentResponse> {
  return apiRequest<EnvironmentResponse>('/llm/environment', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      use_rag: useRag,
      provider: 'auto',
      security_mode: securityMode,
    }),
  })
}

/**
 * 파라미터 수정 (v2.1 보안 모드 지원)
 */
export async function modifyParameters(
  currentConfig: Record<string, unknown>,
  prompt: string,
  securityMode: SecurityMode = 'secure'
): Promise<EnvironmentResponse> {
  return apiRequest<EnvironmentResponse>('/llm/modify', {
    method: 'POST',
    body: JSON.stringify({
      current_config: currentConfig,
      prompt,
      security_mode: securityMode,
    }),
  })
}

/**
 * 전체 파이프라인 실행 (자연어)
 */
export async function runPipeline(prompt: string): Promise<{ status: string; result: PipelineResult }> {
  return apiRequest<{ status: string; result: PipelineResult }>('/pipeline/run', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  })
}

/**
 * LSTM Gap 예측
 */
export async function predictGap(params: {
  sim_throughput: number
  temperature?: number
  humidity?: number
  robot_count?: number
  operation_hours?: number
  warehouse_size?: number
}): Promise<LSTMResponse> {
  return apiRequest<LSTMResponse>('/lstm/predict', {
    method: 'POST',
    body: JSON.stringify({
      sim_throughput: params.sim_throughput,
      temperature: params.temperature ?? 25,
      humidity: params.humidity ?? 50,
      robot_count: params.robot_count ?? 3,
      operation_hours: params.operation_hours ?? 4,
      warehouse_size: params.warehouse_size ?? 500,
    }),
  })
}

/**
 * LSTM 모델 상태 확인
 */
export async function getLSTMStatus(): Promise<{
  model_loaded: boolean
  model_path: string
  model_exists: boolean
  mode: string
  features: string[]
}> {
  return apiRequest('/lstm/status')
}

/**
 * LSTM → LLM 보고서 생성
 */
export async function generateReport(
  lstmResult: LSTMPrediction,
  simConfig: Record<string, unknown>
): Promise<ReportResponse> {
  return apiRequest<ReportResponse>('/llm/report', {
    method: 'POST',
    body: JSON.stringify({
      lstm_result: lstmResult,
      sim_config: simConfig,
    }),
  })
}

/**
 * 학습 현황 통계
 */
export async function getStats(): Promise<StatsResponse> {
  return apiRequest<StatsResponse>('/stats')
}

/**
 * API 상태 확인
 */
export async function getApiStatus(): Promise<{
  service: string
  version: string
  status: string
  features: Record<string, unknown>
  stats: {
    documents: number
    examples: number
    feedback: number
  }
}> {
  return apiRequest('/')
}

/**
 * 피드백 제출
 */
export async function submitFeedback(
  userInput: string,
  llmOutput: Record<string, unknown>,
  isPositive: boolean,
  comment: string = ''
): Promise<{ status: string; message: string; feedback_id: string }> {
  return apiRequest('/feedback', {
    method: 'POST',
    body: JSON.stringify({
      user_input: userInput,
      llm_output: llmOutput,
      is_positive: isPositive,
      comment,
    }),
  })
}

/**
 * Isaac Sim 상태 확인
 */
export async function getIsaacSimStatus(): Promise<{
  connected: boolean
  mode: string
  message: string
  stream_url?: string | null
  details?: Record<string, unknown>
}> {
  return apiRequest('/isaac-sim/status')
}

/**
 * Isaac Sim 스트림 URL 가져오기
 */
export async function getIsaacSimStreamUrl(): Promise<{
  stream_url: string | null
  mode: string
  available: boolean
}> {
  return apiRequest('/isaac-sim/stream')
}

/**
 * 시뮬레이션 시작 (로봇 움직임)
 */
export async function startSimulation(): Promise<{
  success: boolean
  message: string
  robots?: number
}> {
  return apiRequest('/isaac-sim/execute', {
    method: 'POST',
    body: JSON.stringify({
      action: 'start_simulation',
      parameters: {}
    })
  })
}

/**
 * 시뮬레이션 정지
 */
export async function stopSimulation(): Promise<{
  success: boolean
  message: string
}> {
  return apiRequest('/isaac-sim/execute', {
    method: 'POST',
    body: JSON.stringify({
      action: 'stop_simulation',
      parameters: {}
    })
  })
}
