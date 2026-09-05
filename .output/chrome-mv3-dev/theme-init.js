;(function () {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.setAttribute(
    'data-theme',
    prefersDark ? 'dark' : 'light',
  )
})()
