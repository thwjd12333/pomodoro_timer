import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'FocusCal',
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
