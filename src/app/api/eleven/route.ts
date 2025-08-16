import type { NextRequest } from 'next/server'

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1/convai'

function jerr(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function passthrough(res: Response) {
  const text = await res.text()
  const contentType = res.headers.get('content-type') || 'application/json'
  return new Response(text, { status: res.status, headers: { 'Content-Type': contentType } })
}

async function elevenPOST(path: string, body: any) {
  const res = await fetch(`${ELEVEN_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  return passthrough(res)
}

async function elevenGET(path: string) {
  const res = await fetch(`${ELEVEN_BASE}${path}`, {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' },
    cache: 'no-store',
  })
  return passthrough(res)
}

/**
 * Entry point:
 * GET/POST /api/eleven?op=...
 * 
 * ops:
 *   - eleven_submit      (POST) body → POST /batch-calling/submit
 *   - eleven_workspace   (GET)  → GET /batch-calling/workspace
 *   - eleven_batch&batch_id=... (GET) → GET /batch-calling/:batch_id
 *   - eleven_conv&conversation_id=... (GET) → GET /conversations/:conversation_id
 */
export async function GET(req: NextRequest) {
  const op = req.nextUrl.searchParams.get('op') || ''
  try {
    if (op === 'eleven_workspace') {
      return await elevenGET('/batch-calling/workspace')
    }
    if (op === 'eleven_batch') {
      const batchId = req.nextUrl.searchParams.get('batch_id')
      if (!batchId) return jerr('batch_id required')
      return await elevenGET(`/batch-calling/${batchId}`)
    }
    if (op === 'eleven_conv') {
      const convId = req.nextUrl.searchParams.get('conversation_id')
      if (!convId) return jerr('conversation_id required')
      return await elevenGET(`/conversations/${convId}`)
    }
    return jerr('Unsupported op for GET', 405)
  } catch (e: any) {
    return jerr(e?.message || 'Bridge GET failed', 500)
  }
}

export async function POST(req: NextRequest) {
  const op = req.nextUrl.searchParams.get('op') || ''
  try {
    if (op === 'eleven_submit') {
      const body = await req.json()
      return await elevenPOST('/batch-calling/submit', body)
    }
    return jerr('Unsupported op for POST', 405)
  } catch (e: any) {
    return jerr(e?.message || 'Bridge POST failed', 500)
  }
}