import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/ApiResponse.js'
import * as authService from '../services/auth.service.js'

export const login = asyncHandler(async (req, res) => {
  const { role, pin, identifier } = req.body
  const result = await authService.login({ role, pin, identifier })
  sendSuccess(res, { data: result, message: 'Logged in successfully' })
})

export const me = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user.id)
  sendSuccess(res, { data: profile })
})

export const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refresh(req.body.refreshToken)
  sendSuccess(res, { data: tokens, message: 'Token refreshed' })
})

export const logout = asyncHandler(async (_req, res) => {
  // Stateless JWT — the client discards the tokens. (Add a denylist if needed.)
  sendSuccess(res, { message: 'Logged out' })
})
