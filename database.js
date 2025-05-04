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

export async function createPost(title, content, isPublic, userId) {
  let visibility;
  if (isPublic) {
    visibility = "PUBLIC";
  } else {
    visibility = "PRIVATE";
  }

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
      return "Groups succesfully mapped to the given post";
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
    `SELECT group_id FROM user_groups WHERE user_id = ?`,
    [userId]
  );
  connection.release();
  return rows;
}
