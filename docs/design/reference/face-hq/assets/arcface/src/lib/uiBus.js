// Tiny UI command bus — lets the brain (and keyboard) drive the shell
// without import cycles. HQ registers handlers; anyone may call.
export const uiBus = {
  openRoom: (_id) => {}, // set by HQ shell
  enterHQ: () => {}, // set by App
  mode: 'landing',
  room: 'overview',
}
export function registerUI(handlers) {
  Object.assign(uiBus, handlers)
}
