// Game debugging utilities

export const logGameState = (state: {
  autoCall: boolean;
  isCallingNumber: boolean;
  isGameFinished: boolean;
  selectedCartelas: number;
  calledCount: number;
  gameId?: string;
}) => {
  console.group('🎮 Game State Debug');
  console.log('Auto Call:', state.autoCall);
  console.log('Is Calling Number:', state.isCallingNumber);
  console.log('Game Finished:', state.isGameFinished);
  console.log('Selected Cartelas:', state.selectedCartelas);
  console.log('Called Numbers Count:', state.calledCount);
  console.log('Game ID:', state.gameId || 'Not available');
  console.log('Timestamp:', new Date().toISOString());
  console.groupEnd();
};

export const checkForStuckState = (state: {
  autoCall: boolean;
  isCallingNumber: boolean;
  lastCallTime?: number;
}) => {
  const now = Date.now();
  const timeSinceLastCall = state.lastCallTime ? now - state.lastCallTime : 0;
  
  // If auto-calling is on, calling state is true, and it's been more than 30 seconds
  if (state.autoCall && state.isCallingNumber && timeSinceLastCall > 30000) {
    console.warn('⚠️ Potential stuck state detected:');
    console.warn('- Auto call is ON');
    console.warn('- Is calling number is TRUE');
    console.warn(`- Time since last call: ${Math.round(timeSinceLastCall / 1000)}s`);
    return true;
  }
  
  return false;
};

export const resetGameState = () => {
  console.log('🔄 Resetting game state...');
  
  // Clear any stuck intervals
  const highestId = setTimeout(() => {}, 0);
  for (let i = 0; i < highestId; i++) {
    clearTimeout(i);
    clearInterval(i);
  }
  
  console.log('✅ Game state reset completed');
};