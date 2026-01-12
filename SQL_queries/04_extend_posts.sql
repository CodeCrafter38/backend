USE nexus_db;

ALTER TABLE posts ADD video_link VARCHAR(255);
ALTER TABLE posts ADD files JSON;
ALTER TABLE posts ADD teachers_only tinyint NOT NULL DEFAULT 0;