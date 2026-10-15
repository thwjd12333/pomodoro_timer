import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

// chrome-launcher가 직접 만들지 않으므로 미리 생성해둬야 함
const chromiumProfile = fileURLToPath(
  new URL('.wxt/chrome-data', import.meta.url),
)
mkdirSync(chromiumProfile, { recursive: true })

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  // 지정하지 않으면 `npm run dev`마다 임시 프로필로 새 브라우저를 띄워
  // chrome.storage 데이터가 재시작할 때마다 초기화됨 — 고정 프로필로 유지
  webExt: {
    chromiumProfile,
    keepProfileChanges: true,
  },
  manifest: {
    name: 'PomodoroTimer',
    version: '0.0.1',
    description:
      '뽀모도로 타이머 + 일정 타이머를 스티키노트 형태로 관리하는 Chrome Extension',
    permissions: ['alarms', 'notifications', 'storage', 'offscreen'],
    action: {
      default_icon: {
        '16': 'icons/icon16.png',
        '32': 'icons/icon32.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
      },
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+F' },
      },
      'start-pause-timer': {
        suggested_key: { default: 'Alt+S' },
        description: '타이머 시작/일시정지',
      },
      'next-session': {
        suggested_key: { default: 'Alt+N' },
        description: '다음 세션으로',
      },
    },
    icons: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
})
