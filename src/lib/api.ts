// API configuration - Use Vite proxy for all API calls
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface Cartela {
  id: string;
  card_id: string;
  user_id: string | null;
  game_id?: string | null;
  numbers: {
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
  };
  is_winner: boolean;
  winning_pattern?: string | null;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
}

export const cartelaAPI = {
  // Get cartelas for a specific user
  async getUserCartelas(userId: string): Promise<ApiResponse<Cartela[]>> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/cartelas/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result.cartelas || [], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Get all cartelas (admin function)
  async getAllCartelas(): Promise<ApiResponse<Cartela[]>> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/cartelas/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result.cartelas || [], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Get all cartelas (public endpoint - no authentication required)
  async getAllCartelasPublic(): Promise<ApiResponse<Cartela[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/cartelas`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result.cartelas || [], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Create a new cartela
  async createCartela(cartelaData: {
    card_id: string;
    user_id: string;
    numbers: {
      B: number[];
      I: number[];
      N: number[];
      G: number[];
      O: number[];
    };
  }): Promise<ApiResponse<Cartela>> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/cartelas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cartelaData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result.cartela, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Update a cartela
  async updateCartela(
    id: string,
    updates: Partial<{
      user_id: string | null;
      game_id: string | null;
      is_winner: boolean;
      pattern: string;
    }>
  ): Promise<ApiResponse<Cartela>> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/cartelas/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { data: result.cartela, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  },

  // Delete a cartela
  async deleteCartela(id: string): Promise<ApiResponse<null>> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/cartelas/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { data: null, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  }
};
