// Demo Offline User for Testing
// Creates a demo user for offline login testing

import { offlineAuthManager } from './offlineAuthManager';

export const createDemoOfflineUser = async () => {
  try {
    console.log('🔧 Creating demo offline user...');
    
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

    // Cache demo credentials (username: demo, password: demo)
    await offlineAuthManager.cacheCredentials('demo', 'demo', demoUser);
    console.log('✅ Demo offline user created - Username: demo, Password: demo');
    
    // Verify it was created
    const available = await offlineAuthManager.isOfflineLoginAvailable();
    console.log('Demo user available for offline login:', available);
    
  } catch (error) {
    console.error('❌ Failed to create demo user:', error);
  }
};

// Make it available globally for testing
(window as any).createDemoUser = createDemoOfflineUser;

// Auto-create demo user if none exists
export const initializeDemoUser = async () => {
  try {
    console.log('🔍 Initializing demo user...');
    const hasOfflineLogin = await offlineAuthManager.isOfflineLoginAvailable();
    console.log('Has offline login:', hasOfflineLogin);
    
    if (!hasOfflineLogin) {
      console.log('Creating demo offline user...');
      await createDemoOfflineUser();
    } else {
      console.log('✅ Offline login already available');
    }
  } catch (error) {
    console.error('Error initializing demo user:', error);
  }
};