const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Database Migration Tool\n');
console.log('This will migrate your local database to Render.\n');

rl.question('Enter your Render DATABASE_URL: ', (databaseUrl) => {
  if (!databaseUrl.startsWith('postgresql://')) {
    console.error('❌ Invalid DATABASE_URL. Must start with postgresql://');
    rl.close();
    return;
  }

  console.log('\n📤 Step 1: Exporting local database...');
  
  exec('node export-database.js', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Export failed:', error);
      rl.close();
      return;
    }

    console.log(stdout);

    // Find the exported filename
    const match = stdout.match(/database-export-\d+\.json/);
    if (!match) {
      console.error('❌ Could not find export file');
      rl.close();
      return;
    }

    const filename = match[0];
    console.log(`\n📥 Step 2: Importing to Render database...`);

    // Set DATABASE_URL and import
    const importCmd = process.platform === 'win32'
      ? `set DATABASE_URL=${databaseUrl} && node import-database.js ${filename}`
      : `DATABASE_URL=${databaseUrl} node import-database.js ${filename}`;

    exec(importCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Import failed:', error);
        rl.close();
        return;
      }

      console.log(stdout);
      console.log('\n✅ Migration completed successfully!');
      console.log('\n🎉 Your data is now on Render!');
      rl.close();
    });
  });
});
