/**
 * Formats a number by removing trailing zeros after the decimal point
 * @param value - The number to format
 * @param locale - Optional locale string (defaults to 'en-US')
 * @returns Formatted string with trailing zeros removed
 */
export function formatNumber(value: number | string, locale: string = 'en-US'): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return '0';
  }

  // Use locale string for proper formatting
  const formatted = num.toLocaleString(locale);

  // Remove trailing zeros after decimal point
  return formatted.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/**
 * Formats currency values with proper decimal handling
 * @param value - The currency amount to format
 * @param currency - Currency symbol (defaults to 'Birr')
 * @param locale - Optional locale string (defaults to 'en-US')
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | string, currency: string = 'Birr', locale: string = 'en-US'): string {
  if (value === null || value === undefined || value === '') {
    return `0 ${currency}`;
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return `0 ${currency}`;
  }

  const formattedNumber = formatNumber(num, locale);
  return `${formattedNumber} ${currency}`;
}
