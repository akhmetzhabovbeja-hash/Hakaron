UPDATE users SET role = 'MANAGER' WHERE email = 'manager@test.com';
SELECT id, email, name, role FROM users;
SELECT id, text, category, is_system FROM questions LIMIT 5;
