export interface User {
  id: string;
  username: string | null;
  email: string;
  role: string;
  userType?: 'prepaid' | 'postpaid';
  balance: number;
  balanceLimit?: number | null;
  totalGamesPlayed: number;
  totalWinnings: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
