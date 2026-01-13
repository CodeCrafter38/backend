USE nexus_db;

INSERT INTO users (username, email, password, role)
VALUES 
  ('admin', 'admin@example.com', '$2a$12$62TYYx8DfJF3e1l4oA6p/OOMV/qaqjble1EXXTs1OYuVNEvClV3j6', 'ADMIN'),
  ('student', 'student@example.com', '$2a$12$yRUd9RelLLNGEBmnApgi6.qVhXWxk3q258lIjfIN2dCgVHvcmffMG', 'STUDENT'),
  ('teacher', 'teacher@example.com', '$2a$12$hWL/JwZuJ6K1NvS/fDOvvePicIUumP0nyu6PBltOBDOnTgsvBPdQu', 'TEACHER');


INSERT INTO groups_nexus (name, description, created_by, teachers_only)
VALUES 
  ('Computer scientists', 'We can code well!', 1, 0),
  ('Mechanical engineers', 'We can build machines well!', 2, 0);


INSERT INTO user_groups (user_id, group_id)
VALUES 
  (1, 1),
  (1, 2),
  (2, 2);


INSERT INTO posts (title, content, visibility, user_id, teachers_only)
VALUES 
  ('Why I Love MySQL', 'It is fast and reliable for most use cases.', 'PUBLIC', 1, 0),
  ('Building machines With Passion', 'How to build consistently every day.', 'PUBLIC', 2, 0);


INSERT INTO comments (content, post_id, user_id)
VALUES 
  ('I love MySQL too.', 1, 2),
  ('I know how to build machines too.', 2, 3);


INSERT INTO post_groups (post_id, group_id)
VALUES
  (1, 1),
  (2, 2);