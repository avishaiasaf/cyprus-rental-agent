export function validatePriceRange(
  min?: number,
  max?: number,
): { valid: boolean; error?: string } {
  if (min != null && min < 0) {
    return { valid: false, error: 'Price cannot be negative' };
  }
  if (max != null && max < 0) {
    return { valid: false, error: 'Price cannot be negative' };
  }
  if (min != null && max != null && min > max) {
    return { valid: false, error: 'Min must be less than max' };
  }
  return { valid: true };
}
