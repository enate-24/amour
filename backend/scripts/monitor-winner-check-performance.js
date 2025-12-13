const fetch = require('node-fetch');

async function monitorWinnerCheckPerformance() {
  console.log('📊 Monitoring winner check performance...');
  
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3003/api';
  
  // Test data for performance monitoring
  const testCases = [
    {
      name: 'Quick Check - No Winner',
      data: {
        cartelaId: '1',
        patterns: ['Two Lines'],
        calledNumbers: [1, 2, 3, 4, 5] // Few numbers, unlikely to win
      }
    },
    {
      name: 'Medium Check - Possible Winner',
      data: {
        cartelaId: '1',
        patterns: ['One Line'],
        calledNumbers: Array.from({length: 20}, (_, i) => i + 1) // 20 numbers
      }
    },
    {
      name: 'Full Check - Many Numbers',
      data: {
        cartelaId: '1',
        patterns: ['Full House'],
        calledNumbers: Array.from({length: 50}, (_, i) => i + 1) // 50 numbers
      }
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE_URL}/winner-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.data)
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const result = await response.json();
      
      results.push({
        name: testCase.name,
        duration: duration,
        success: response.ok,
        win: result.win || false,
        calledNumbers: testCase.data.calledNumbers.length
      });
      
      console.log(`   ⏱️ Duration: ${duration}ms`);
      console.log(`   ✅ Success: ${response.ok}`);
      console.log(`   🎯 Winner: ${result.win || false}`);
      
      if (duration > 1000) {
        console.log(`   ⚠️ SLOW RESPONSE (>${duration}ms)`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        name: testCase.name,
        duration: -1,
        success: false,
        error: error.message
      });
    }
  }
  
  // Performance summary
  console.log('\n📈 PERFORMANCE SUMMARY');
  console.log('========================');
  
  const successfulTests = results.filter(r => r.success);
  
  if (successfulTests.length > 0) {
    const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
    const maxDuration = Math.max(...successfulTests.map(r => r.duration));
    const minDuration = Math.min(...successfulTests.map(r => r.duration));
    
    console.log(`Average response time: ${avgDuration.toFixed(2)}ms`);
    console.log(`Fastest response: ${minDuration}ms`);
    console.log(`Slowest response: ${maxDuration}ms`);
    
    if (avgDuration > 500) {
      console.log('\n⚠️ PERFORMANCE ISSUES DETECTED:');
      console.log('- Average response time > 500ms');
      console.log('- Consider running the optimization script');
      console.log('- Check database connection and indexes');
    } else {
      console.log('\n✅ Performance looks good!');
    }
  } else {
    console.log('❌ No successful tests to analyze');
  }
  
  console.log('\n🔧 OPTIMIZATION RECOMMENDATIONS:');
  console.log('1. Run: node backend/scripts/optimize-winner-check-performance.js');
  console.log('2. Check database connection latency');
  console.log('3. Monitor server resources (CPU, memory)');
  console.log('4. Consider caching frequently accessed cartelas');
}

// Instructions
console.log('📋 Winner Check Performance Monitor');
console.log('==================================');
console.log('This script tests the winner check endpoint performance');
console.log('Make sure the backend server is running before executing');
console.log('');

monitorWinnerCheckPerformance()
  .then(() => {
    console.log('\n✅ Performance monitoring complete');
  })
  .catch(error => {
    console.error('\n❌ Monitoring failed:', error.message);
  });