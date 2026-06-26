/**
 * Standard success envelope so every endpoint returns a consistent shape:
 * { success, message, data, meta }
 */
export function sendSuccess(res, { data = null, message = 'OK', meta = undefined, status = 200 } = {}) {
  return res.status(status).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  })
}

export function sendCreated(res, data, message = 'Created') {
  return sendSuccess(res, { data, message, status: 201 })
}

export default sendSuccess
