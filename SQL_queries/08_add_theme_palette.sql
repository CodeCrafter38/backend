USE nexus_db;

ALTER TABLE users
ADD theme_mode ENUM('light', 'dark') NOT NULL DEFAULT 'dark',
ADD theme_palette VARCHAR(32) NOT NULL DEFAULT 'nexus';