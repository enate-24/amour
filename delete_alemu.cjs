const https = require('https');
const http = require('http');
const readline = require('readline');

// Configuration
const API_BASE_URL = process.env.VITE_API_URL || 'https://amour-bingo-backend.onrender.com/api';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

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
    console.log('=== DELETE USER ALEMU.GONDE ===\n');
    
    // Ask for admin token
    const adminToken = await askQuestion('Enter your admin JWT token: ');
    
    if (!adminToken.trim()) {
      console.log('❌ Admin token is required');
      rl.close();
      return;
    }

    console.log('\n🔍 Searching for user Alemu.Gonde...');
    
    // Get all users
    const usersResponse = await makeRequest(`${API_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken.trim()}`,
        'Content-Type': 'application/json'
      }
    });

    if (usersResponse.status !== 200) {
      console.log('❌ Failed to fetch users (Status:', usersResponse.status, ')');
      console.log('Response:', usersResponse.data);
      
      if (usersResponse.status === 401) {
        console.log('💡 This usually means your admin token is invalid or expired');
        console.log('💡 Please get a fresh token by logging in as admin again');
      } else if (usersResponse.status === 403) {
        console.log('💡 This means you don\'t have admin permissions');
      } else if (usersResponse.status === 400) {
        console.log('💡 Bad request - check if the API endpoint is correct');
      }
      
      rl.close();
      return;
    }

    const users = usersResponse.data.users;
    
    // Search for Alemu.Gonde (case-insensitive, multiple variations)
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
      console.log('\nAvailable users:');
      users.forEach(u => console.log(`- ${u.username} (${u.email})`));
      rl.close();
      return;
    }

    console.log('✅ Found user:');
    console.log(`   ID: ${targetUser.id}`);
    console.log(`   Username: ${targetUser.username}`);
    console.log(`   Email: ${targetUser.email}`);
    console.log(`   Role: ${targetUser.role}`);
    console.log(`   Active: ${targetUser.is_active}`);

    // Confirm deletion
    const confirm = await askQuestion('\n⚠️  Are you sure you want to DELETE this user? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled');
      rl.close();
      return;
    }

    // Delete the user (hard delete)
    console.log('\n🗑️ Deleting user...');
    const deleteResponse = await makeRequest(`${API_BASE_URL}/admin/users/${targetUser.id}?hardDelete=true`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken.trim()}`,
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
  } finally {
    rl.close();
  }
}

console.log('To get your admin token:');
console.log('1. Open your bingo app in browser');
console.log('2. Login as admin');
console.log('3. Press F12 → Application → Local Storage');
console.log('4. Copy the "auth_token" value\n');

findAndDeleteUser();