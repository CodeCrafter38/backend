import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql
  .createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
  })
  .promise();

export async function getPosts() {
  const connection = await pool.getConnection();
  const [rows] = await connection.query("SELECT * FROM posts");
  connection.release();
  return rows;
}

export async function getPost(id) {
  const connection = await pool.getConnection();
  //prepared statement, send sql query and user-given value separately to avoid sql-injection
  const [rows] = await connection.query(`SELECT * FROM posts WHERE id = ?`, [
    id,
  ]);
  connection.release();
  return rows[0];
}

export async function getAllPostsWithComments() {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    "SELECT posts.id, posts.title, posts.content, posts.created_at, comments.id, comments.content, comments.created_at FROM posts LEFT JOIN comments ON posts.id = comments.post_id GROUP BY p.id"
  );
  connection.release();
  return rows;
}

export async function getPublicPostsWithComments() {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    "SELECT p.id, p.title, p.content, p.created_at, p.user_id, JSON_ARRAYAGG(CASE WHEN c.id IS NOT NULL THEN JSON_OBJECT('id',c.id, 'content',c.content, 'created_at',c.created_at, 'user_id',c.user_id) ELSE JSON_OBJECT('content', NULL) END ) AS comments FROM posts p LEFT JOIN comments c ON c.post_id = p.id WHERE p.visibility = 'PUBLIC' GROUP BY p.id ORDER BY p.created_at DESC"
  );
  connection.release();
  return rows;
}

export async function getPostsWithCommentsByUserGroups(userId) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    // duplikált kommentek, ha több csoporthoz is hozzá van adva az adott poszt
    // JSON_ARRAYAGG-al - DISTINCT nem működik vele
    // `SELECT p.id, p.title, p.content, p.created_at, p.user_id, JSON_ARRAYAGG(CASE WHEN c.id IS NOT NULL THEN JSON_OBJECT('id',c.id, 'content',c.content, 'created_at',c.created_at, 'user_id',c.user_id) ELSE JSON_OBJECT('content', NULL) END ) AS comments FROM posts p JOIN post_groups pg ON p.id = pg.post_id JOIN user_groups ug ON pg.group_id = ug.group_id LEFT JOIN comments c ON c.post_id = p.id WHERE p.visibility = 'PRIVATE' AND ug.user_id = ? GROUP BY p.id ORDER BY p.created_at DESC`
    // CAST(CONCAT-el - nem működik annak ellenére, hogy ezt ajánlják workaround-nak
    `SELECT p.id, p.title, p.content, p.created_at, p.user_id, CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id',c.id, 'content',c.content, 'created_at',c.created_at, 'user_id',c.user_id)), ']') AS JSON) AS comments FROM posts p JOIN post_groups pg ON p.id = pg.post_id JOIN user_groups ug ON pg.group_id = ug.group_id LEFT JOIN comments c ON c.post_id = p.id WHERE p.visibility = 'PRIVATE' AND ug.user_id = ? GROUP BY p.id ORDER BY p.created_at DESC`,
    [userId]
  );
  connection.release();
  return rows;
}

export async function createPost(title, content, visibility, userId) {
  const connection = await pool.getConnection();
  //await connection.beginTransaction();
  let insertedPostId;
  try {
    const [result] = await connection.query(
      `INSERT INTO posts (title, content, visibility, user_id) VALUES (?, ?, ?, ?)`,
      [title, content, visibility, userId]
    );
    insertedPostId = result.insertId;
    connection.release();
    try {
      const newPost = await getPost(insertedPostId);
      return newPost;
    } catch (e) {
      throw e;
    }
  } catch (e) {
    //await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

export async function mapGroupsToPost(postId, groupIds) {
  if (groupIds) {
    const connection = await pool.getConnection();
    try {
      groupIds.forEach(async (groupId) => {
        await connection.query(
          `INSERT INTO post_groups (post_id, group_id) VALUES (?, ?)`,
          [postId, groupId]
        );
      });
      return "Poszt csoportokhoz rendelése sikeres";
    } catch (e) {
      throw new Error(e.message);
    } finally {
      connection.release();
    }
  } else {
    return undefined;
  }
}

export async function updatePost(id, title, content) {
  const connection = await pool.getConnection();
  const [result] = await connection.query(
    `UPDATE posts SET title = ?, content = ? WHERE id = ?`,
    [id, title, content]
  );
  connection.release();
  const resultId = result.insertId;
  return await getPost(resultId);
}

export async function getUserById(id) {
  const connection = await pool.getConnection();
  //prepared statement, send sql query and user-given value separately to avoid sql-injection
  const [rows] = await connection.query(`SELECT * FROM users WHERE id = ?`, [
    id,
  ]);
  connection.release();
  return rows[0];
}

export async function getUserByName(username) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT * FROM users WHERE username = ?`,
    [username]
  );
  connection.release();
  return rows[0];
}

export async function getUserByEmail(email) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(`SELECT * FROM users WHERE email = ?`, [
    email,
  ]);
  connection.release();
  return rows[0];
}

export async function createUser(username, email, password, role) {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
      [username, email, password, role]
    );
    connection.release();
    const id = result.insertId;
    return await getUserById(id);
  } catch (e) {
    throw new Error(e.message);
  }
}

export async function getGroupsOfUser(userId) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT user_groups.group_id, groups_nexus.name FROM user_groups JOIN groups_nexus ON user_groups.group_id=groups_nexus.id WHERE user_id = ?`,
    [userId]
  );
  connection.release();
  return rows;
}

export async function createComment(content, postId, userId) {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      `INSERT INTO comments (content, post_id, user_id) VALUES (?, ?, ?)`,
      [content, postId, userId]
    );
    connection.release();
    const id = result.insertId;
    return await getCommentById(id);
  } catch (e) {
    throw new Error(e.message);
  }
}

export async function getComments() {
  const connection = await pool.getConnection();
  const [rows] = await connection.query("SELECT * FROM comments");
  connection.release();
  return rows;
}

export async function getCommentById(id) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(`SELECT * FROM comments WHERE id = ?`, [
    id,
  ]);
  connection.release();
  return rows[0];
}
