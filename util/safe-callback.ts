/**
 * Wrap a callback so errors are logged but never thrown.
 * Handles both synchronous throws and asynchronous Promise rejections.
 * Use this for ANY deferred work (timers, event listeners, etc.)
 * to prevent extension crashes from killing the Pi process.
 */
export function safe<T extends (...args: any[]) => any>(
	label: string,
	fn: T,
): T {
	return ((...args: any[]) => {
		try {
			const result = fn(...args);
			// Catch Promise rejections from async functions
			if (result && typeof (result as Promise<unknown>).then === "function") {
				(result as Promise<unknown>).catch((err: unknown) => {
					console.error(`[pi-ask-user-glimpse] ${label} async error:`, err);
				});
			}
			return result;
		} catch (err) {
			console.error(`[pi-ask-user-glimpse] ${label} error:`, err);
		}
	}) as T;
}
