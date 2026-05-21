import { createSign, createHash, randomUUID } from 'crypto'

const BUCKET = process.env.GCS_BUCKET_NAME!
const CLIENT_EMAIL = process.env.GCS_CLIENT_EMAIL!
const PRIVATE_KEY = process.env.GCS_PRIVATE_KEY!
const EXPIRES = 900 // 15 minutos

export interface SignedUrlResult {
  signedUrl: string
  publicUrl: string
}

export function generateSignedUrl(
  filename: string,
  tenantId: string | number,
  contactId: string | number
): SignedUrlResult {
  if (!BUCKET || !CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error('GCS no configurado: faltan GCS_BUCKET_NAME, GCS_CLIENT_EMAIL o GCS_PRIVATE_KEY')
  }
  const key = PRIVATE_KEY.replace(/\\n/g, '\n')
  const now = new Date()
  const datestamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timestamp = `${datestamp}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const objectName = `tickets/${tenantId}/${contactId}/${randomUUID()}-${safeFilename}`
  const encodedPath = `/${BUCKET}/${objectName.split('/').map(encodeURIComponent).join('/')}`

  const credentialScope = `${datestamp}/auto/storage/goog4_request`
  const signedHeaders = 'host'

  const params: [string, string][] = [
    ['X-Goog-Algorithm', 'GOOG4-RSA-SHA256'],
    ['X-Goog-Credential', `${CLIENT_EMAIL}/${credentialScope}`],
    ['X-Goog-Date', timestamp],
    ['X-Goog-Expires', String(EXPIRES)],
    ['X-Goog-SignedHeaders', signedHeaders],
  ]

  const canonicalQuery = params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const canonicalRequest = [
    'PUT',
    encodedPath,
    canonicalQuery,
    `host:storage.googleapis.com\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'GOOG4-RSA-SHA256',
    timestamp,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  const signer = createSign('RSA-SHA256')
  signer.update(stringToSign)
  const signature = signer.sign(key, 'hex')

  return {
    signedUrl: `https://storage.googleapis.com${encodedPath}?${canonicalQuery}&X-Goog-Signature=${signature}`,
    publicUrl: `https://storage.googleapis.com/${BUCKET}/${objectName}`,
  }
}
