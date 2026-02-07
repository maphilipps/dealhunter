/**
 * Run async functions with bounded concurrency.
 * Executes items through fn with at most `concurrency` running simultaneously.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Create a promise that removes itself from the executing array upon completion
    let promiseToRemove: Promise<void> | null = null;
    const promise = (async () => {
      try {
        results[i] = await fn(item, i);
      } finally {
        // This will be executed when the promise settles (resolves or rejects)
        // We use a functional approach to remove the specific promise instance
        if (promiseToRemove) {
          const index = executing.indexOf(promiseToRemove);
          if (index !== -1) {
            void executing.splice(index, 1);
          }
        }
      }
    })();
    promiseToRemove = promise;
    void promise;

    executing.push(promise);

    if (executing.length >= concurrency) {
      const racePromise = Promise.race(executing);
      await racePromise;
    }
  }

  await Promise.all(executing);
  return results;
}
