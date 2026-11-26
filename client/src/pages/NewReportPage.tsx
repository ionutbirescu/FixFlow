import { type ChangeEvent, type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { errorMessage, isApiError } from '../api/errors'
import { createReport } from '../api/reports'
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { API_MOCKING } from '../config'
import { formatBytes } from '../format'
import { useMachines } from '../hooks/useMachines'

/**
 * Upload a photo of a faulty machine with a description (`POST /reports` on S1), then follow the report on its
 * own page while the AI works on it. The photo is checked here first, so a wrong file fails before the upload.
 */
export function NewReportPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const machines = useMachines()
  const photoInput = useRef<HTMLInputElement>(null)
  // The picked file, and a blob: URL to show it before it is sent
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const id = useId()

  // Frees the previous preview when another photo is picked, and the last one when the page closes
  useEffect(() => (photo ? () => URL.revokeObjectURL(photo.preview) : undefined), [photo])

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null
    const problem = file && checkPhoto(file)
    // A file we won't send doesn't stay picked, so the field shows what will be uploaded
    if (problem) event.currentTarget.value = ''
    setPhoto(file && !problem ? { file, preview: URL.createObjectURL(file) } : null)
    setPhotoError(problem)
  }

  function removePhoto() {
    if (photoInput.current) photoInput.current.value = ''
    setPhoto(null)
    setPhotoError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const machineId = String(form.get('machineId') ?? '')
    const description = String(form.get('description') ?? '').trim()
    if (!photo) {
      setPhotoError('Choose a photo of the fault.')
      return
    }
    if (!machineId || !description) {
      setError('Choose the machine and describe the fault.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const { reportId } = await createReport({ image: photo.file, machineId, description })
      navigate(`/reports/${reportId}`)
    } catch (err) {
      setError(uploadError(err))
      setSubmitting(false)
    }
  }

  const photoHintId = `${id}-photo-hint`
  const photoErrorId = `${id}-photo-error`

  return (
    <section className="new-report">
      <h1>New report</h1>
      <p className="muted">
        Photograph the fault and say what you see. The AI reads both, with the machine's maintenance history, and
        suggests what to do next.
      </p>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {machines.status === 'error' && (
        <div className="notice notice-error notice-row" role="alert">
          <span>{machines.message}</span>
          <button className="button button-small" type="button" onClick={machines.retry}>
            Try again
          </button>
        </div>
      )}

      {machines.status === 'ready' && machines.machines.length === 0 && (
        <p className="notice">
          There are no machines to report on yet.{' '}
          {session?.role === 'MANAGER' ? <Link to="/machines/new">Add the first one.</Link> : 'Ask a manager to add one.'}
        </p>
      )}

      <form className="report-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Machine</span>
          <select name="machineId" required defaultValue="" disabled={machines.status !== 'ready'}>
            <option value="" disabled>
              {machines.status === 'loading' ? 'Loading machines…' : 'Choose a machine'}
            </option>
            {machines.status === 'ready' &&
              machines.machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name} · {machine.location}
                </option>
              ))}
          </select>
        </label>

        <label className="field">
          <span id={`${id}-photo`}>Photo</span>
          <input
            ref={photoInput}
            type="file"
            accept={IMAGE_TYPES.join(',')}
            // Not `required`: the browser's own "select a file" bubble would hide our message below
            aria-required="true"
            onChange={handlePhotoChange}
            // The hint and the error sit inside the label; keep them out of the field's name
            aria-labelledby={`${id}-photo`}
            aria-describedby={photoError ? `${photoErrorId} ${photoHintId}` : photoHintId}
            aria-invalid={photoError ? true : undefined}
          />
          <small id={photoHintId} className="field-hint">
            JPG or PNG, up to {formatBytes(MAX_IMAGE_BYTES)}. Drop it on the field or choose a file.
          </small>
          {photoError && (
            <small id={photoErrorId} className="field-error" role="alert">
              {photoError}
            </small>
          )}
        </label>

        {photo && (
          <figure className="upload-preview">
            <img src={photo.preview} alt={`Preview of ${photo.file.name}`} />
            <figcaption>
              <span>
                {photo.file.name} · {formatBytes(photo.file.size)}
              </span>
              <button className="button button-small" type="button" onClick={removePhoto}>
                Remove
              </button>
            </figcaption>
          </figure>
        )}

        <label className="field">
          <span>Description</span>
          <textarea
            name="description"
            required
            rows={4}
            placeholder="What's wrong, where on the machine, and since when"
          />
        </label>

        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={submitting || machines.status !== 'ready'}>
            {submitting ? 'Uploading…' : 'Send report'}
          </button>
          <Link className="button" to="/reports">
            Cancel
          </Link>
        </div>

        {API_MOCKING && (
          <p className="hint">
            Mock API: the description decides the result. <code>smoke</code> gives Critical, <code>leak</code> High,{' '}
            <code>noise</code> Medium, anything else Low, and <code>#fail</code> makes the AI fail.
          </p>
        )}
      </form>
    </section>
  )
}

/** Why the browser won't send this file, or `null` if it may. S1 checks the same (415 and 413). */
function checkPhoto(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
    return `${file.name} isn't a JPG or PNG. Choose a photo in one of those formats.`
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}. Choose a photo of ${formatBytes(MAX_IMAGE_BYTES)} or less.`
  }
  return null
}

function uploadError(error: unknown): string {
  if (isApiError(error, 413)) return `The photo is larger than ${formatBytes(MAX_IMAGE_BYTES)}. Choose a smaller one.`
  if (isApiError(error, 415)) return 'The photo must be a JPG or PNG.'
  return errorMessage(error, "Couldn't send the report. Try again.")
}
