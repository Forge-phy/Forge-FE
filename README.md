# Forge Frontend

**Forge** — Physical AI 시뮬레이션 플랫폼 프론트엔드

자연어 입력으로 Isaac Sim 시뮬레이션을 생성하고, 결과를 시각화하며, Sim2Real 갭 예측 보고서를 제공합니다.

## 주요 기능

- **대시보드**: 시뮬레이션 상태 및 통계 한눈에 보기
- **시뮬레이션 제어**: 자연어 입력 → Isaac Sim 파라미터 설정 → 실행
- **3D 시각화**: Three.js 기반 창고/공장 환경 렌더링
- **WebRTC 스트리밍**: Isaac Sim 화면 실시간 브라우저 스트리밍
- **결과 분석**: Sim2Real 갭 예측 결과 시각화
- **보고서**: LSTM 기반 성능 예측 보고서 생성

## 기술 스택

- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Pinia
- **Routing**: Vue Router
- **3D**: Three.js
- **Streaming**: NVIDIA WebRTC Streaming Library

## 프로젝트 구조

```
src/
├── main.ts              # 엔트리포인트
├── App.vue              # 루트 컴포넌트
├── api/
│   └── forge.ts         # 백엔드 API 통신
├── router/
│   └── index.ts         # 라우팅 설정
├── views/
│   ├── DashboardView.vue    # 메인 대시보드
│   ├── SimulationView.vue   # 시뮬레이션 제어
│   ├── AnalysisView.vue     # 결과 분석
│   └── ReportsView.vue      # 보고서
├── components/
│   ├── IsaacSimViewer.vue       # Isaac Sim 3D 뷰어
│   ├── IsaacSimStreamViewer.vue # WebRTC 스트림 뷰어
│   └── WarehouseViewer.vue      # 창고 3D 시각화
├── layouts/
│   └── DefaultLayout.vue    # 기본 레이아웃
├── stores/
│   └── counter.ts           # Pinia 상태 관리
└── assets/
    └── main.css             # 전역 스타일
```

## 실행 방법

### 개발 모드

```bash
npm install
npm run dev
```

### 빌드

```bash
npm run build
```

### Docker

```bash
docker build -t forge-frontend .
docker run -p 80:80 forge-frontend
```

## 페이지 라우팅

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | Dashboard | 메인 대시보드 |
| `/simulation` | Simulation | 시뮬레이션 제어 |
| `/analysis` | Analysis | 결과 분석 |
| `/reports` | Reports | 보고서 보기 |

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `VITE_API_URL` | 백엔드 API URL | `http://localhost:8000` |
| `VITE_ISAAC_STREAM_URL` | Isaac Sim 스트림 URL | `http://localhost:8899` |

## 디자인 시스템

| 색상 | 용도 | HEX |
|------|------|-----|
| Primary | 주요 액션, 링크 | `#6366f1` |
| Secondary | 보조 액션 | `#22d3ee` |
| Dark | 배경 | `#1e1e2e` |
| Light | 텍스트 배경 | `#f8fafc` |

## 라이선스

MIT License
