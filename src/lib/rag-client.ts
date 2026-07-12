export function queueRagIngestion(topicId: string): void {
  void fetch('/api/ai/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicId }),
  })
    .then(() => fetch('/api/ai/ingest/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 3 }),
    }))
    .catch(() => {})
}

export function processQueuedRag(limit = 5): void {
  void fetch('/api/ai/ingest/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  }).catch(() => {})
}
