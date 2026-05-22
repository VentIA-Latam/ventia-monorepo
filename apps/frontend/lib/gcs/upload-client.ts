interface SignedUrlResponse {
  signedUrl: string
  publicUrl: string
}

async function getSignedUrl(file: File, contactId?: number): Promise<SignedUrlResponse> {
  const params = new URLSearchParams({ filename: file.name, contentType: file.type })
  if (contactId !== undefined) params.set('contactId', String(contactId))

  const res = await fetch(`/api/tickets/upload-url?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Error al preparar subida (${res.status})`)
  }
  return res.json()
}

// Importado dinámicamente desde use-ticket-form — no está en el bundle inicial
export async function uploadFilesToGCS(files: File[], contactId?: number): Promise<string[]> {
  // async-parallel: todos los archivos se suben simultáneamente
  return Promise.all(
    files.map(async (file) => {
      const { signedUrl, publicUrl } = await getSignedUrl(file, contactId)

      const res = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!res.ok) throw new Error(`Error al subir ${file.name} (${res.status})`)
      return publicUrl
    })
  )
}
