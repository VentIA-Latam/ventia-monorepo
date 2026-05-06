import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth0'
import { getCurrentUser } from '@/lib/services/user-service'
import { generateSignedUrl } from '@/lib/gcs/storage'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'])

export async function GET(request: Request) {
  // Iniciar token fetch inmediatamente (async-api-routes: no waterfall)
  const tokenPromise = getAccessToken()

  const { searchParams } = new URL(request.url)
  const filename = searchParams.get('filename')
  const contentType = searchParams.get('contentType')
  const contactId = searchParams.get('contactId')

  if (!filename || !contentType || !contactId) {
    return NextResponse.json({ error: 'Parámetros requeridos: filename, contentType, contactId' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo JPG, PNG, PDF y MP4.' }, { status: 400 })
  }

  if (isNaN(Number(contactId))) {
    return NextResponse.json({ error: 'contactId debe ser numérico' }, { status: 400 })
  }

  const token = await tokenPromise
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const user = await getCurrentUser(token)
  if (user.role?.toUpperCase() !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo administradores pueden adjuntar archivos' }, { status: 403 })
  }

  try {
    const result = generateSignedUrl(filename, user.tenant_id, contactId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error generando signed URL:', error)
    return NextResponse.json({ error: 'Error al preparar la subida' }, { status: 500 })
  }
}
