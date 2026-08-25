/**
 * A tiny concurrency limiter for running async tasks with bounded parallelism,
 * while preserving result order.
 */

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    // `nextIndex` is read and incremented synchronously, so no two workers can
    // claim the same slot.
    for (let index = nextIndex; index < items.length; index = nextIndex) {
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  };

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
