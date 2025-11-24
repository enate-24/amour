const { users } = require('./backend/data/database.js');

(async () => {
  try {
    const allUsers = await users.findAll();
    const targetUser = allUsers.find(u => u.username === 'alemu.gonde' || u.email === 'alemu.gonde');
    
    if (targetUser) {
      console.log('Found user:');
      console.log('ID:', targetUser.id);
      console.log('Username:', targetUser.username);
      console.log('Email:', targetUser.email);
      console.log('Role:', targetUser.role);
      console.log('Active:', targetUser.is_active);
    } else {
      console.log('User alemu.gonde not found');
      console.log('Available users:');
      allUsers.forEach(u => console.log('- ' + u.username + ' (' + u.email + ')'));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
})();