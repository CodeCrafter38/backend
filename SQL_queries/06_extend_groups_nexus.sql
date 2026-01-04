USE nexus_db;

ALTER TABLE groups_nexus ADD teachers_only BOOLEAN NOT NULL DEFAULT FALSE;
