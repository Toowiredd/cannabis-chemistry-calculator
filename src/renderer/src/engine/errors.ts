/**
 * Custom ValidationError for engine input validation.
 * Used when inputs violate domain constraints.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
