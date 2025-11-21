import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types (PostgreSQL schema)
export interface Database {
  public: {
    Tables: {
      cartelas: {
        Row: {
          id: string;
          card_id: string;
          user_id: string | null;
          game_id: string | null;
          numbers: string; // JSON string in PostgreSQL
          pattern: string | null;
          is_active: boolean;
          is_winner: boolean;
          purchased_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          user_id?: string | null;
          game_id?: string | null;
          numbers: string; // JSON string
          pattern?: string | null;
          is_active?: boolean;
          is_winner?: boolean;
          purchased_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          user_id?: string | null;
          game_id?: string | null;
          numbers?: string;
          pattern?: string | null;
          is_active?: boolean;
          is_winner?: boolean;
          purchased_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          username: string | null;
          password_hash: string;
          role: string;
          balance: number;
          total_games_played: number;
          total_winnings: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          username?: string | null;
          password_hash: string;
          role?: string;
          balance?: number;
          total_games_played?: number;
          total_winnings?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          username?: string | null;
          password_hash?: string;
          role?: string;
          balance?: number;
          total_games_played?: number;
          total_winnings?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          game_number: number | null;
          status: string;
          bet_money: number;
          win_money: number;
          cartelas_selected: number;
          called_numbers: string; // JSON string
          total_numbers: number;
          winner_pattern: string;
          house_cut_percentage: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_number?: number | null;
          status?: string;
          bet_money?: number;
          win_money?: number;
          cartelas_selected?: number;
          called_numbers?: string;
          total_numbers?: number;
          winner_pattern?: string;
          house_cut_percentage?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_number?: number | null;
          status?: string;
          bet_money?: number;
          win_money?: number;
          cartelas_selected?: number;
          called_numbers?: string;
          total_numbers?: number;
          winner_pattern?: string;
          house_cut_percentage?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
