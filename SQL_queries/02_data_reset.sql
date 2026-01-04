USE nexus_db;

-- Ideiglenesen letiltjuk az idegen kulcs ellenőrzéseket
SET FOREIGN_KEY_CHECKS = 0;

-- Először a kapcsolótáblák kiürítése
DELETE FROM post_groups;
DELETE FROM user_groups;

-- A fő táblák kiürítése (a sorrend számít az idegen kulcs függőségek miatt)
DELETE FROM comments;
DELETE FROM posts;
DELETE FROM groups_nexus;
DELETE FROM users;
DELETE FROM sessions;

-- Visszaállítjuk az idegen kulcs ellenőrzéseket
SET FOREIGN_KEY_CHECKS = 1;