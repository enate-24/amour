export interface User {
  id: string;
  username: string | null;
  email: string;
  role: string;
  balance: number;
  totalGamesPlayed: number;
  totalWinnings: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
