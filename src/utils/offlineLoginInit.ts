// Offline Login Initialization
// Simple utility to set up offline login capabilities

import { offlineStorage } from './offlineStorage';
import { offlineAuthManager } from './offlineAuthManager';

export const initializeOfflineLogin = async () => {
  try {
    console.log('🔧 Initializing offline login system...');
    
    // 1. Initialize offline storage
    await offlineStorage.initialize();
    console.log('✅ Offline storage ready');
    
    // 2. Create demo user if none exists
    const hasOfflineLogin = await offlineAuthManager.isOfflineLoginAvailable();
    if (!hasOfflineLogin) {
      console.log('📝 Creating demo user for offline login...');
      
      const demoUser = {
        id: 'demo_user_123',
        username: 'demo',
        email: 'demo@example.com',
        role: 'user',
        userType: 'prepaid',
        balance: 1000,
        balanceLimit: null,
        totalGamesPlayed: 5,
        totalWinnings: 250,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await offlineAuthManager.cacheCredentials('demo', 'demo', demoUser);
      console.log('✅ Demo user created - Username: demo, Password: demo');
    } else {
      console.log('✅ Offline login already available');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize offline login:', error);
    return false;
  }
};

export const testOfflineLogin = async () => {
  try {
    console.log('🧪 Testing offline login...');
    
    const result = await offlineAuthManager.attemptOfflineLogin('demo', 'demo');
    
    if (result.success) {
      console.log('✅ Offline login test successful:', result.user);
      return result.user;
    } else {
      console.error('❌ Offline login test failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Offline login test error:', error);
    return null;
  }
};