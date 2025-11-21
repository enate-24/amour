/**
 * Safe JSON parsing utilities to prevent JSON parsing errors
 */

/**
 * Safely parse JSON data with fallback
 * @param {string|any} data - Data to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} Parsed data or fallback
 */
function safeJSONParse(data, fallback = null) {
  // Handle null, undefined, or empty values
  if (data === null || data === undefined || data === '' || data === '""' || data === '"') {
    return fallback;
  }
  
  // If already parsed (not a string), return as-is
  if (typeof data !== 'string') {
    return data;
  }
  
  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn('JSON parse error:', error.message, 'Data:', data.substring(0, 50));
    return fallback;
  }
}

/**
 * Safely parse JSON array with array fallback
 * @param {string|any} data - Data to parse
 * @param {Array} fallback - Fallback array (default: [])
 * @returns {Array} Parsed array or fallback
 */
function safeJSONParseArray(data, fallback = []) {
  const parsed = safeJSONParse(data, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

/**
 * Safely parse JSON object with object fallback
 * @param {string|any} data - Data to parse
 * @param {Object} fallback - Fallback object (default: {})
 * @returns {Object} Parsed object or fallback
 */
function safeJSONParseObject(data, fallback = {}) {
  const parsed = safeJSONParse(data, fallback);
  return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : fallback;
}

/**
 * Safely stringify data to JSON
 * @param {any} data - Data to stringify
 * @param {string} fallback - Fallback string (default: '[]')
 * @returns {string} JSON string or fallback
 */
function safeJSONStringify(data, fallback = '[]') {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.warn('JSON stringify error:', error.message);
    return fallback;
  }
}

module.exports = {
  safeJSONParse,
  safeJSONParseArray,
  safeJSONParseObject,
  safeJSONStringify
};