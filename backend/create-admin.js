require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  console.log('👤 Creating new admin user...\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('aivencloud.com') ? {
      // Aiven-specific SSL configuration
      rejectUnauthorized: false, // Aiven uses self-signed certificates
      checkServerIdentity: () => undefined // Skip hostname verification for Aiven
    } : {
      rejectUnauthorized: true // Use proper SSL verification for other providers
    },
    max: 1,
    connectionTimeoutMillis: 30000
  });
  
  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to Aiven PostgreSQL');
    
    // Admin credentials
    const adminEmail = 'admin@bingo.com';
    const adminPassword = 'admin@2456';
    const adminUsername = 'admin';
    
    console.log('\n🔐 Creating admin user with credentials:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Username: ${adminUsername}`);
    console.log(`Password: ${adminPassword}`);
    
    // Hash the password
    console.log('\n🔒 Hashing password...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    console.log('✅ Password hashed successfully');
    
    // Check if user already exists
    console.log('\n🔍 Checking if user already exists...');
    const existingUser = await client.query(
      'SELECT id, email, username, role FROM users WHERE email = $1 OR username = $2',
      [adminEmail, adminUsername]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('⚠️ User already exists, updating credentials...');
      
      // Update existing user
      await client.query(`
        UPDATE users 
        SET 
          username = $1,
          email = $2,
          password = $3,
          role = $4,
          user_type = $5,
          balance = $6,
          is_active = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE email = $2 OR username = $1
      `, [
        adminUsername,
        adminEmail,
        hashedPassword,
        'admin',
        'postpaid',
        50000.00, // Give admin a high balance
        true
      ]);
      
      console.log('✅ Admin user updated successfully');
      
    } else {
      console.log('➕ Creating new admin user...');
      
      // Create new user
      await client.query(`
        INSERT INTO users (username, email, password, balance, user_type, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        adminUsername,
        adminEmail,
        hashedPassword,
        50000.00, // Give admin a high balance
        'postpaid',
        'admin',
        true
      ]);
      
      console.log('✅ Admin user created successfully');
    }
    
    // Verify the user was created/updated
    console.log('\n🔍 Verifying admin user...');
    const verifyUser = await client.query(
      'SELECT id, username, email, role, user_type, balance, is_active, created_at FROM users WHERE email = $1',
      [adminEmail]
    );
    
    if (verifyUser.rows.length > 0) {
      const user = verifyUser.rows[0];
      console.log('✅ Admin user verified:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  User Type: ${user.user_type}`);
      console.log(`  Balance: $${user.balance}`);
      console.log(`  Active: ${user.is_active}`);
      console.log(`  Created: ${user.created_at}`);
    } else {
      console.error('❌ Failed to verify admin user creation');
    }
    
    // Create user settings for the admin
    console.log('\n⚙️ Creating user settings...');
    await client.query(`
      INSERT INTO user_settings (user_id, voice_category, sound_enabled, auto_mark)
      SELECT id, 'men', true, false FROM users WHERE email = $1
      ON CONFLICT (user_id) DO UPDATE SET
        voice_category = EXCLUDED.voice_category,
        sound_enabled = EXCLUDED.sound_enabled,
        auto_mark = EXCLUDED.auto_mark,
        updated_at = CURRENT_TIMESTAMP
    `, [adminEmail]);
    console.log('✅ User settings created');
    
    // Show all admin users
    console.log('\n👥 All admin users in database:');
    const allAdmins = await client.query(
      "SELECT id, username, email, role, user_type, balance, is_active FROM users WHERE role = 'admin' ORDER BY id"
    );
    
    allAdmins.rows.forEach((admin, index) => {
      console.log(`  ${index + 1}. ${admin.username} (${admin.email}) - Balance: $${admin.balance} - Active: ${admin.is_active}`);
    });
    
    client.release();
    
    console.log('\n🎉 Admin user setup completed successfully!');
    console.log('\n🔐 Login Credentials:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('\n📋 You can now:');
    console.log('1. Start your frontend application');
    console.log('2. Login with the new admin credentials');
    console.log('3. Access the admin dashboard');
    console.log('4. Manage users and games');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    console.log('\n🔧 Error details:');
    console.log(`Message: ${error.message}`);
    console.log(`Code: ${error.code || 'N/A'}`);
    
    if (error.code === '23505') {
      console.log('\n💡 This error usually means the user already exists.');
      console.log('Try updating the existing user instead.');
    }
  } finally {
    await pool.end();
  }
}

createAdmin();