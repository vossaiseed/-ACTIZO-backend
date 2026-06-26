/* Minimal leveled logger (swap for pino/winston in production). */
const ts = () => new Date().toISOString()

export const logger = {
  info: (...a) => console.log(`\x1b[36m[INFO]\x1b[0m ${ts()}`, ...a),
  warn: (...a) => console.warn(`\x1b[33m[WARN]\x1b[0m ${ts()}`, ...a),
  error: (...a) => console.error(`\x1b[31m[ERROR]\x1b[0m ${ts()}`, ...a),
  success: (...a) => console.log(`\x1b[32m[OK]\x1b[0m ${ts()}`, ...a),
}

export default logger
