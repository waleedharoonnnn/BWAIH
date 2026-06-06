export function createSSEStream(): {
  stream: ReadableStream
  emit: (event: string, data: unknown) => void
  close: () => void
} {
  let controller: ReadableStreamDefaultController<Uint8Array>
  let closed = false
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
    cancel() {
      closed = true
    },
  })

  function emit(event: string, data: unknown) {
    if (closed) return
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      controller.enqueue(encoder.encode(payload))
    } catch {
      closed = true
    }
  }

  function close() {
    if (closed) return
    closed = true
    try {
      controller.close()
    } catch {
      // already closed by client disconnect
    }
  }

  return { stream, emit, close }
}
