CREATE DATABASE nexus_db;
USE nexus_db;


CREATE TABLE users (
  id integer PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'STUDENT', 'TEACHER') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


CREATE TABLE groups_nexus (
  id integer AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by integer NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE posts (
  id integer PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  visibility ENUM('PUBLIC', 'PRIVATE'),
  labels JSON,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id integer NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE comments (
  id integer PRIMARY KEY AUTO_INCREMENT,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  post_id integer NOT NULL,
  user_id integer NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE user_groups (
  user_id integer NOT NULL,
  group_id integer NOT NULL,
  PRIMARY KEY (user_id, group_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups_nexus(id) ON DELETE CASCADE
);


CREATE TABLE post_groups (
  post_id integer NOT NULL,
  group_id integer NOT NULL,
  PRIMARY KEY (post_id, group_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups_nexus(id) ON DELETE CASCADE
);

