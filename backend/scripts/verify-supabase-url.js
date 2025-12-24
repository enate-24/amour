#!/usr/bin/env node

/**
 * Supabase URL Verification Guide
 * Helps you get the correct connection string from Supabase
 */

console.log('🔍 Supabase URL Verification Guide');
console.log('==================================\n');

console.log('📋 Step 1: Get Your Correct Supabase URL');
console.log('------------------------------------------');
console.log('1. Go to https://supabase.com/dashboard');
console.log('2. Select your project');
console.log('3. Go to Settings → Database');
console.log('4. Scroll down to "Connection string"');
console.log('5. Copy the "URI" connection string');
console.log('');

console.log('🔗 Your connection string should look like:');
console.log('postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres');
console.log('');

console.log('📝 Current URL in your .env file:');
const currentUrl = process.env.DATABASE_URL;
if (currentUrl) {
  // Hide password for security
  const maskedUrl = currentUrl.replace(/:[^:@]*@/, ':****@');
  console.log(maskedUrl);
  
  // Parse and validate URL format
  try {
    const url = new URL(currentUrl);
    console.log('\n✅ URL format is valid');
    console.log(`🏠 Host: ${url.hostname}`);
    console.log(`🚪 Port: ${url.port || 5432}`);
    console.log(`🗄️ Database: ${url.pathname.slice(1)}`);
    console.log(`👤 User: ${url.username}`);
    
    // Check if it looks like a Supabase URL
    if (url.hostname.includes('supabase.co')) {
      console.log('✅ This looks like a Supabase URL');
    } else {
      console.log('⚠️ This doesn\'t look like a Supabase URL');
    }
  } catch (error) {
    console.log('❌ URL format is invalid:', error.message);
  }
} else {
  console.log('❌ No DATABASE_URL found in .env file');
}

console.log('\n🔧 Common Issues and Solutions:');
console.log('-------------------------------');

console.log('\n1. 🔑 Password Issues:');
console.log('   • Special characters need URL encoding');
console.log('   • @ becomes %40');
console.log('   • # becomes %23');
console.log('   • & becomes %26');
console.log('   • Example: "pass@123#" becomes "pass%40123%23"');

console.log('\n2. 🌐 Network Issues:');
console.log('   • Try from mobile hotspot');
console.log('   • Disable VPN/proxy');
console.log('   • Check firewall settings');
console.log('   • Change DNS to 8.8.8.8, 8.8.4.4');

console.log('\n3. 🏗️ Project Issues:');
console.log('   • Make sure your Supabase project is active');
console.log('   • Check if project is paused (free tier limitation)');
console.log('   • Verify you\'re using the correct project');

console.log('\n4. 🔄 Alternative Solutions:');
console.log('   • Try Neon.tech (another free PostgreSQL)');
console.log('   • Use local PostgreSQL for development');
console.log('   • Try Railway.app with $5 free credit');

console.log('\n📞 Next Steps:');
console.log('--------------');
console.log('1. Double-check your Supabase connection string');
console.log('2. Try connecting from a different network');
console.log('3. Test with a simple PostgreSQL client (like pgAdmin)');
console.log('4. Contact Supabase support if the URL is correct');

console.log('\n💡 Quick Test:');
console.log('Try this command to test basic connectivity:');
console.log('ping db.xwkwmpezzpoqgovxfesj.supabase.co');
console.log('');
console.log('If ping fails, it\'s a network/DNS issue on your end.');
console.log('If ping works but PostgreSQL fails, it\'s a database configuration issue.');

console.log('\n🎯 Alternative Free PostgreSQL Providers:');
console.log('------------------------------------------');
console.log('• Neon.tech - Very reliable, 512MB free');
console.log('• Railway.app - $5 monthly credit');
console.log('• Aiven.io - 1 month free trial');
console.log('• ElephantSQL - 20MB free (very small)');

console.log('\nWould you like to try a different provider or troubleshoot further?');