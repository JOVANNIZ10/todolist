import { describe, expect, it } from 'vitest'
import { ApiError, isAuthError, isNetworkError } from './apiClient'

describe('clasificación de errores de la API', () => {
  it('reconoce un fallo de red aunque no haya código HTTP', () => {
    expect(isNetworkError(new ApiError('Sin conexión', 0))).toBe(true)
  })

  it('no confunde las respuestas del servidor con fallos de red', () => {
    expect(isNetworkError(new ApiError('Error', 500))).toBe(false)
    expect(isNetworkError(new ApiError('Sesión', 401))).toBe(false)
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(false)
  })

  it('distingue la caducidad de sesión de un fallo de red', () => {
    expect(isAuthError(new ApiError('Sesión', 401))).toBe(true)
    expect(isAuthError(new ApiError('Sin conexión', 0))).toBe(false)
  })
})
