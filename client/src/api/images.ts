import { type RequestOptions, s2 } from './http'

/**
 * `GET /images/{id}` (S2). The endpoint needs the Bearer token, which an `<img src>` can't send, so fetch the
 * file here and show it with `URL.createObjectURL(blob)` (and `URL.revokeObjectURL` when done).
 */
export async function getImage(id: string, { signal }: RequestOptions = {}): Promise<Blob> {
  const { data } = await s2.get<Blob>(`/images/${encodeURIComponent(id)}`, { responseType: 'blob', signal })
  return data
}
