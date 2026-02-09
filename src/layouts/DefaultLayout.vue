<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { ref, computed } from 'vue'

const route = useRoute()
const sidebarOpen = ref(true)

const navItems = [
  { name: '대시보드', path: '/', icon: 'home' },
  { name: '시뮬레이션', path: '/simulation', icon: 'play' },
  { name: '결과 분석', path: '/analysis', icon: 'chart' },
  { name: '리포트', path: '/reports', icon: 'document' },
]

const currentPageTitle = computed(() => {
  const item = navItems.find((item) => item.path === route.path)
  return item?.name || 'Forge'
})

const isConnected = ref(true)
</script>

<template>
  <div class="flex h-screen bg-[#0a0a0f] text-white overflow-hidden">
    <!-- Sidebar -->
    <aside
      :class="[
        'flex flex-col bg-[#12121a] border-r border-white/5 transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-64' : 'w-20',
      ]"
    >
      <!-- Logo -->
      <div class="flex items-center h-20 px-4">
        <RouterLink to="/" class="flex items-center gap-3 group">
          <div class="relative">
            <img
              src="/Forge logo.png"
              alt="Forge"
              class="w-14 h-14 object-contain transition-transform duration-300 group-hover:scale-110"
            />
            <div
              class="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            ></div>
          </div>
          <div v-if="sidebarOpen" class="flex flex-col">
            <span
              class="text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent"
            >
              Forge
            </span>
            <span class="text-[10px] text-gray-500 -mt-1">v2.0</span>
          </div>
        </RouterLink>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-6 space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
            route.path === item.path
              ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5',
          ]"
        >
          <!-- Active indicator -->
          <div
            v-if="route.path === item.path"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"
          ></div>

          <!-- Icons -->
          <div
            :class="[
              'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200',
              route.path === item.path
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25'
                : 'bg-white/5 group-hover:bg-white/10',
            ]"
          >
            <svg
              v-if="item.icon === 'home'"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <svg
              v-if="item.icon === 'play'"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <svg
              v-if="item.icon === 'chart'"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <svg
              v-if="item.icon === 'document'"
              class="w-5 h-5"
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

          <span v-if="sidebarOpen" class="font-medium text-sm">{{ item.name }}</span>
        </RouterLink>
      </nav>

      <!-- Bottom Section -->
      <div class="p-3 space-y-2">
        <!-- Connection Status -->
        <div v-if="sidebarOpen" class="px-3 py-3 rounded-xl bg-white/5 border border-white/5">
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-400">Isaac Sim</span>
            <div class="flex items-center gap-2">
              <div
                :class="[
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-red-400',
                ]"
              ></div>
              <span class="text-xs" :class="isConnected ? 'text-emerald-400' : 'text-red-400'">
                {{ isConnected ? '연결됨' : '연결 끊김' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Toggle Button -->
        <button
          @click="sidebarOpen = !sidebarOpen"
          class="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 flex items-center justify-center"
        >
          <svg
            class="w-5 h-5 text-gray-400 transition-transform duration-300"
            :class="{ 'rotate-180': !sidebarOpen }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <header
        class="h-16 bg-[#12121a]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6"
      >
        <div class="flex items-center gap-4">
          <h1 class="text-lg font-semibold">{{ currentPageTitle }}</h1>
          <div class="h-4 w-px bg-white/10"></div>
          <span class="text-sm text-gray-500">Isaac Sim 브릿지 + AI 예측</span>
        </div>

        <div class="flex items-center gap-4">
          <!-- Search -->
          <div class="relative">
            <input
              type="text"
              placeholder="검색..."
              class="w-64 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all"
            />
            <svg
              class="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <!-- Notifications -->
          <button class="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <svg
              class="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <div class="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full"></div>
          </button>

          <!-- Profile -->
          <button
            class="flex items-center gap-3 p-1.5 pr-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-medium"
            >
              Y
            </div>
            <span class="text-sm">사용자</span>
          </button>
        </div>
      </header>

      <!-- Page Content -->
      <div class="flex-1 overflow-auto bg-gradient-to-br from-[#0a0a0f] to-[#0f0f1a]">
        <div class="p-6">
          <RouterView />
        </div>
      </div>
    </main>
  </div>
</template>
