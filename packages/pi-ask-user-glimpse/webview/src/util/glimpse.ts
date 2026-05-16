/**
 * Send data to the Glimpse native host through the global window.glimpse bridge.
 */
export function sendToGlimpse(data: unknown): void {
  (window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send(data);
}

/**
 * Signal that the user cancelled the dialog.
 */
export function sendCancelled(): void {
  sendToGlimpse({ __cancelled: true });
}
