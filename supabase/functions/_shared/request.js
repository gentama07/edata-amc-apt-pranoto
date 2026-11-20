export async function readRequestBody(request, maxBytes) {
  const declaredLength = Number(request.headers.get('Content-Length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: 'Ukuran permintaan melampaui batas.' }
  }

  if (!request.body) return { ok: false, status: 400, error: 'Isi permintaan tidak valid.' }
  const reader = request.body.getReader()
  const chunks = []
  let size = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        return { ok: false, status: 413, error: 'Ukuran permintaan melampaui batas.' }
      }
      chunks.push(value)
    }

    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { ok: true, bytes }
  } catch {
    return { ok: false, status: 400, error: 'Isi permintaan tidak valid.' }
  } finally {
    reader.releaseLock()
  }
}

export async function readJsonBody(request, maxBytes) {
  const body = await readRequestBody(request, maxBytes)
  if (!body.ok) return body

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(body.bytes)
    const value = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, status: 400, error: 'Isi permintaan tidak valid.' }
    }
    return { ok: true, value }
  } catch {
    return { ok: false, status: 400, error: 'Isi permintaan tidak valid.' }
  }
}
