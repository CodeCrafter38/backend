import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql
  .createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  })
  .promise();

export async function getPosts() {
  const [rows] = await pool.query("SELECT * FROM posts");
  return rows;
}

export async function getPost(id) {
  //prepared statement, send sql query and user-given value separately to avoid sql-injection
  const [rows] = await pool.query(`SELECT * FROM posts WHERE id = ?`, [id]);
  return rows[0];
}

export async function createPost(title, content, user_id, group_id) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const [result] = await connection.query(
      `INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)`,
      [title, content, user_id]
    );
    const insertedPostId = result.insertId;

    await connection.query(
      `INSERT INTO post_groups (insertedPostId, group_id) VALUES (?, ?)`,
      [insertedPostId, group_id]
    );
    return getPost(insertedPostId);
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

export async function updatePost(id, title, content) {
  const [result] = await pool.query(
    `UPDATE posts SET title = ?, content = ? WHERE id = ?`,
    [id, title, content]
  );
  const resultId = result.insertId;
  return getPost(resultId);
}

export async function getUserById(id) {
  //prepared statement, send sql query and user-given value separately to avoid sql-injection
  const [rows] = await pool.query(`SELECT * FROM users WHERE id = ?`, [id]);
  return rows[0];
}

export async function getUserByName(username) {
  const [rows] = await pool.query(`SELECT * FROM users WHERE username = ?`, [
    username,
  ]);
  return rows[0];
}

export async function getUserByEmail(email) {
  const [rows] = await pool.query(`SELECT * FROM users WHERE email = ?`, [
    email,
  ]);
  return rows[0];
}

export async function createUser(username, email, password, role) {
  const [result] = await pool.query(
    `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
    [username, email, password, role]
  );
  const id = result.insertId;
  return getUserById(id);
}
