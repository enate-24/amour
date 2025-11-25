require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .sort(); // Run migrations in alphabetical order
  
  console.log(`Found ${migrationFiles.length} migration files:\n`);
  migrationFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');
  
  for (const file of migrationFiles) {
    try {
      console.log(`\n📝 Running migration: ${file}`);
      const migrationModule = require(path.join(migrationsDir, file));
      
      // Handle different export patterns
      let migration;
      if (typeof migrationModule === 'function') {
        migration = migrationModule;
      } else if (migrationModule && typeof migrationModule.default === 'function') {
        migration = migrationModule.default;
      } else if (migrationModule && typeof Object.values(migrationModule)[0] === 'function') {
        migration = Object.values(migrationModule)[0];
      } else {
        console.log(`⚠️ Skipping ${file}: No valid migration function found`);
        continue;
      }
      
      await migration();
      console.log(`✅ Completed: ${file}`);
    } catch (error) {
      console.error(`❌ Failed: ${file}`);
      console.error(error);
      // Continue with other migrations even if one fails
    }
  }
  
  console.log('\n✅ All migrations completed!');
  process.exit(0);
}

runMigrations().catch(error => {
  console.error('❌ Migration process failed:', error);
  process.exit(1);
});
