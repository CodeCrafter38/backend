USE nexus_db;

ALTER TABLE groups_nexus ADD teachers_only tinyint NOT NULL DEFAULT 0;
