USE nexus_db;

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Clear junction tables first
DELETE FROM post_groups;
DELETE FROM user_groups;

-- Clear core tables (order does matter due to foreign key dependencies)
DELETE FROM comments;
DELETE FROM posts;
DELETE FROM groups;
DELETE FROM users;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;