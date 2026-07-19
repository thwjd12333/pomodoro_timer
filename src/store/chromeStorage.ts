import type { StateStorage } from 'zustand/middleware'

// Zustand persist가 요구하는 인터페이스에 맞게 chrome.storage.sync를 감쌈
export const chromeStorage: StateStorage = {
  getItem: async name => {
    const result = await chrome.storage.sync.get(name)
    return (result[name] as string | undefined) ?? null
  },
  setItem: async (name, value) => {
    await chrome.storage.sync.set({ [name]: value })
  },
  removeItem: async name => {
    await chrome.storage.sync.remove(name)
  },
}
