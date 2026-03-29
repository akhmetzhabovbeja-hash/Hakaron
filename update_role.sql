UPDATE users SET role = 'HR' WHERE email = 'hr@test.com';
UPDATE users SET role = 'MANAGER' WHERE email = 'manager@test.com';
SELECT id, email, phone, name, role FROM users;
SELECT count(*) as questions_count FROM questions WHERE is_system = true;
