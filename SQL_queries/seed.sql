USE nexus_db;


INSERT INTO users (username, email, password, role)
VALUES 
  ('alice', 'alice@example.com', 'hashed_pw_1', 'ADMIN'),
  ('jay', 'jay@example.com', 'hashed_pw_2', 'STUDENT'),
  ('bob', 'bob@example.com', 'hashed_pw_3', 'TEACHER');


INSERT INTO groups_nexus (name, description, created_by)
VALUES 
  ('Computer scientists', 'We can code well!', 1),
  ('Mechanical engineers', 'We can build machines well!', 2);


INSERT INTO user_groups (user_id, group_id)
VALUES 
  (1, 1),
  (1, 2),
  (2, 2);


INSERT INTO posts (title, content, user_id)
VALUES 
  ('Why I Love MySQL', 'It is fast and reliable for most use cases.', 1),
  ('Building machines With Passion', 'How to build consistently every day.', 2);


INSERT INTO comments (content, post_id, user_id)
VALUES 
  ('I love MySQL too.', 1, 2),
  ('I know how to build machines too.', 2, 3);


INSERT INTO post_groups (post_id, group_id)
VALUES
  (1, 1),
  (2, 2);