// Network utility functions for handling connection issues

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

export interface NetworkError extends Error {
  isNetworkError: boolean;
  isTimeout: boolean;
  isQuicError: boolean;
}

// Create a custom network error
export const createNetworkError = (message: string, originalError?: Error): NetworkError => {
  const error = new Error(message) as NetworkError;
  error.isNetworkError = true;
  error.isTimeout = originalError?.name === 'AbortError';
  error.isQuicError = message.includes('ERR_QUIC_PROTOCOL_ERROR') || message.includes('Failed to fetch');
  return error;
};

// Enhanced fetch with retry logic and better error handling
export const fetchWithRetry = async (
  url: string, 
  options: FetchOptions = {}
): Promise<Response> => {
  const { timeout = 30000, retries = 2, ...fetchOptions } = options;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error) {
      const isLastAttempt = attempt === retries;
      
      if (error instanceof Error) {
        console.warn(`Fetch attempt ${attempt + 1} failed:`, error.message);
        
        if (isLastAttempt) {
          if (error.name === 'AbortError') {
            throw createNetworkError('Request timeout - the server took too long to respond', error);
          } else if (error.message.includes('ERR_QUIC_PROTOCOL_ERROR') || error.message.includes('Failed to fetch')) {
            throw createNetworkError('Network connection error. The backend server may be unavailable.', error);
          } else {
            throw createNetworkError(error.message, error);
          }
        }
        
        // Wait before retrying (exponential backoff)
        if (!isLastAttempt) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        throw createNetworkError('Unknown network error');
      }
    }
  }
  
  throw createNetworkError('All retry attempts failed');
};

// Check if error is a network-related error
export const isNetworkError = (error: any): error is NetworkError => {
  return error?.isNetworkError === true;
};

// Get user-friendly error message
export const getNetworkErrorMessage = (error: any): string => {
  if (isNetworkError(error)) {
    if (error.isTimeout) {
      return 'Request timeout - the server took too long to respond. Please try again.';
    } else if (error.isQuicError) {
      return 'Network connection error. The backend server may be unavailable. Please check your connection and try again.';
    }
  }
  
  return error?.message || 'An unexpected error occurred';
};

// Health check utility
export const checkServerHealth = async (baseUrl: string): Promise<boolean> => {
  try {
    const response = await fetchWithRetry(`${baseUrl}/health`, {
      method: 'GET',
      timeout: 10000,
      retries: 1
    });
    
    return response.ok;
  } catch (error) {
    console.warn('Server health check failed:', error);
    return false;
  }
};