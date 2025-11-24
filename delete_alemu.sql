-- Delete user Alemu.Gonde and all associated data
-- Run this in your PostgreSQL database

-- First, let's find the user
SELECT id, username, email, role, is_active 
FROM users 
WHERE LOWER(username) LIKE '%alemu%' 
   OR LOWER(email) LIKE '%alemu%'
   OR username = 'Alemu.Gonde'
   OR email = 'Alemu.Gonde';

-- If you found the user and want to delete them, uncomment and run the following:
-- (Replace 'USER_ID_HERE' with the actual user ID from the query above)

/*
-- Delete user and all associated data (CASCADE will handle related records)
DELETE FROM users 
WHERE LOWER(username) LIKE '%alemu%' 
   OR LOWER(email) LIKE '%alemu%'
   OR username = 'Alemu.Gonde'
   OR email = 'Alemu.Gonde';

-- Verify deletion
SELECT COUNT(*) as remaining_alemu_users 
FROM users 
WHERE LOWER(username) LIKE '%alemu%' 
   OR LOWER(email) LIKE '%alemu%';
*/