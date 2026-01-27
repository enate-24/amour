const fs = require('fs');
const path = require('path');

// Read the admin.js file
const adminFilePath = path.join(__dirname, 'routes', 'admin.js');
let content = fs.readFileSync(adminFilePath, 'utf8');

// Remove all instances of 'id: require('uuid').v4(),' from adminLogs.create calls
content = content.replace(/(\s+)id: require\('uuid'\)\.v4\(\),\n(\s+)adminId:/g, '$1adminId:');

// Write the file back
fs.writeFileSync(adminFilePath, content, 'utf8');

console.log('✅ Fixed all admin log UUID references in admin.js');
console.log('🔧 Removed id field from all adminLogs.create() calls');