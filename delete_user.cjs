const https = require('https');
const http = require('http');

// Configuration - update these with your actual values
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // You'll need to provide this

async function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function findAndDeleteUser() {
  try {
    if (!ADMIN_TOKEN) {
      console.log('❌ ADMIN_TOKEN environment variable is required');
      console.log('Please set it with: set ADMIN_TOKEN=your_admin_jwt_token');
      return;
    }

    console.log('🔍 Searching for user Alemu.Gonde...');
    
    // Get all users
    const usersResponse = await makeRequest(`${API_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (usersResponse.status !== 200) {
      console.log('❌ Failed to fetch users:', usersResponse.data);
      return;
    }

    const users = usersResponse.data.users;
    // Search case-insensitive for various forms of the name
    const targetUser = users.find(u => 
      u.username.toLowerCase() === 'alemu.gonde' || 
      u.email.toLowerCase() === 'alemu.gonde' ||
      u.username === 'Alemu.Gonde' ||
      u.email === 'Alemu.Gonde' ||
      u.username.toLowerCase().includes('alemu') ||
      u.email.toLowerCase().includes('alemu')
    );

    if (!targetUser) {
      console.log('❌ User Alemu.Gonde not found');
      console.log('Available users:');
      users.forEach(u => console.log(`- ${u.username} (${u.email})`));
      return;
    }

    console.log('✅ Found user:');
    console.log(`   ID: ${targetUser.id}`);
    console.log(`   Username: ${targetUser.username}`);
    console.log(`   Email: ${targetUser.email}`);
    console.log(`   Role: ${targetUser.role}`);
    console.log(`   Active: ${targetUser.is_active}`);

    // Delete the user (hard delete)
    console.log('🗑️ Deleting user...');
    const deleteResponse = await makeRequest(`${API_BASE_URL}/admin/users/${targetUser.id}?hardDelete=true`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (deleteResponse.status === 200) {
      console.log('✅ User deleted successfully!');
      console.log('   Message:', deleteResponse.data.message);
      if (deleteResponse.data.deletedData) {
        console.log('   Deleted cartelas:', deleteResponse.data.deletedData.cartelas);
        console.log('   Affected games:', deleteResponse.data.deletedData.affectedGames);
      }
    } else {
      console.log('❌ Failed to delete user:', deleteResponse.data);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findAndDeleteUser();