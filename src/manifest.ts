import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'FocusCal',
  version: '0.0.1',
  description:
    '뽀모도로 타이머 + 일정 타이머를 스티키노트 형태로 관리하는 Chrome Extension',
  permissions: ['alarms', 'notifications', 'storage', 'offscreen'],
  action: {
    default_popup: 'src/popup/popup.html',
    default_icon: {
      '16': 'public/icons/icon16.png',
      '32': 'public/icons/icon32.png',
      '48': 'public/icons/icon48.png',
      '128': 'public/icons/icon128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
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
    '16': 'public/icons/icon16.png',
    '32': 'public/icons/icon32.png',
    '48': 'public/icons/icon48.png',
    '128': 'public/icons/icon128.png',
  },
})
