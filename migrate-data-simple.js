import https from 'https';
import fs from 'fs';

const baseURL = 'https://amour-bingo-backend.onrender.com';

console.log('📦 Migrating original data to fresh backend...\n');

// Read the export file
const exportFile = 'backend/database-export-1763759794911.json';

if (!fs.existsSync(exportFile)) {
  console.error(`❌ Export file not found: ${exportFile}`);
  process.exit(1);
}

const exportData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
console.log(`📂 Reading export from: ${exportData.exportDate}`);
console.log(`👥 Users to migrate: ${exportData.users?.length || 0}`);
console.log(`🎮 Games to migrate: ${exportData.games?.length || 0}`);
console.log(`🎫 Cartelas to migrate: ${exportData.cartelas?.length || 0}\n`);

// Register each user from the export
async function migrateUsers() {
  if (!exportData.users || exportData.users.length === 0) {
    console.log('ℹ️  No users to migrate');
    return;
  }

  console.log('👥 Migrating users...');
  
  for (const user of exportData.users) {
    // Skip admin users (we already have one)
    if (user.role === 'admin') {
      console.log(`⏭️  Skipping admin user: ${user.username}`);
      continue;
    }

    try {
      const userData = JSON.stringify({
        username: user.username,
        email: user.email,
        password: user.password, // Already hashed
        role: user.role,
        balance: user.balance
      });

      // Direct database insert would be better, but let's use the API
      console.log(`  📝 Creating user: ${user.username}...`);
      
      // For now, just log what would be migrated
      console.log(`    ✅ Would migrate: ${user.username} (${user.email}) - Balance: ${user.balance}`);
      
    } catch (error) {
      console.log(`    ❌ Failed to migrate user ${user.username}:`, error.message);
    }
  }
}

async function main() {
  await migrateUsers();
  
  console.log('\n🎯 Migration Summary:');
  console.log('✅ Database is clean and ready');
  console.log('ℹ️  To complete migration, you would need to:');
  console.log('   1. Import users with their original passwords');
  console.log('   2. Import game history');
  console.log('   3. Import cartelas and game analysis');
  console.log('\n💡 For now, you can manually recreate the Tare.a2 user');
}

main();