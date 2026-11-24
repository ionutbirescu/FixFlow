// Reads a multipart/form-data body (the POST /reports upload) from its bytes.
// Request.formData() works in the browser, but not in the Vitest tests: under jsdom, Node's parser builds each
// file part with jsdom's File class and then rejects it. Parsing the bytes here works everywhere.

export interface MultipartFile {
  filename: string
  type: string
  bytes: ArrayBuffer
}

export type MultipartValue = string | MultipartFile

const CRLF = [13, 10]
const BLANK_LINE = [13, 10, 13, 10]
const DASH = 45

/** The body's fields by name, or `null` if it isn't well-formed multipart. */
export async function readMultipart(request: Request): Promise<Map<string, MultipartValue> | null> {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(request.headers.get('Content-Type') ?? '')
  if (!match) return null
  const delimiter = new TextEncoder().encode(`--${match[1] ?? match[2]}`)
  const body = new Uint8Array(await request.arrayBuffer())
  const decoder = new TextDecoder()
  const fields = new Map<string, MultipartValue>()

  let at = indexOf(body, delimiter, 0)
  if (at === -1) return null
  for (;;) {
    const end = at + delimiter.length
    if (body[end] === DASH && body[end + 1] === DASH) return fields // "--boundary--" closes the body
    if (indexOf(body, CRLF, end) !== end) return null
    const headersEnd = indexOf(body, BLANK_LINE, end)
    if (headersEnd === -1) return null
    const next = indexOf(body, delimiter, headersEnd)
    if (next === -1) return null

    const headers = decoder.decode(body.subarray(end + CRLF.length, headersEnd))
    const content = body.slice(headersEnd + BLANK_LINE.length, next - CRLF.length) // the CRLF before a delimiter is not content
    const name = /\bname="([^"]*)"/i.exec(headers)?.[1]
    const filename = /\bfilename="([^"]*)"/i.exec(headers)?.[1]
    if (name !== undefined) {
      fields.set(
        name,
        filename === undefined
          ? decoder.decode(content)
          : { filename, type: /^content-type:\s*([^;\r\n]+)/im.exec(headers)?.[1].trim() ?? '', bytes: content.buffer },
      )
    }
    at = next
  }
}

function indexOf(haystack: Uint8Array, needle: ArrayLike<number>, from: number): number {
  search: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue search
    }
    return i
  }
  return -1
}
