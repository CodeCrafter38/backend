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
  // prepared statement (előkészített utasítás), afelhasználó által megadott értékeket
  // az sql query-től külön küldjük be, és előfeldolgozza az adatbázis-engine az sql-injection elleni védelemhez
  const [rows] = await connection.query(`SELECT * FROM posts WHERE id = ?`, [
    id,
  ]);
  connection.release();
  return rows[0];
}

export async function getAllPostsWithComments() {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    "SELECT p.id, p.title, p.content, p.labels, p.created_at, p.user_id, p.video_link, p.files, JSON_ARRAYAGG(CASE WHEN c.id IS NOT NULL THEN JSON_OBJECT('id',c.id, 'content',c.content, 'created_at',c.created_at, 'user_id',c.user_id) ELSE JSON_OBJECT('content', NULL) END ) AS comments FROM posts p LEFT JOIN comments c ON c.post_id = p.id GROUP BY p.id ORDER BY p.created_at DESC"
  );
  connection.release();
  return rows;
}

export async function getPublicPostsWithComments() {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    "SELECT p.id, p.title, p.content, p.labels, p.created_at, p.user_id, p.video_link, p.files, JSON_ARRAYAGG(CASE WHEN c.id IS NOT NULL THEN JSON_OBJECT('id',c.id, 'content',c.content, 'created_at',c.created_at, 'user_id',c.user_id) ELSE JSON_OBJECT('content', NULL) END ) AS comments FROM posts p LEFT JOIN comments c ON c.post_id = p.id WHERE p.visibility = 'PUBLIC' GROUP BY p.id ORDER BY p.created_at DESC"
  );
  connection.release();
  return rows;
}

export async function getPostsWithCommentsByUserGroups(groupIds) {
  const resultPosts = [];
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  // lekérdezzük a felhasználó csoportjai alapján az összes posztot, minden posztot csak egyszer (distinct)
  try {
    const [postRows] = await connection.query(
      `SELECT DISTINCT p.id
      FROM posts p
      JOIN post_groups pg ON p.id = pg.post_id
      WHERE p.visibility = 'PRIVATE' AND pg.group_id IN (?)`,
      [groupIds]
    );

    // kiszedjük a posztok id-jait, ami alapján le tudjuk kérdezni hozzájuk a kommenteket
    const postIds = postRows.map((row) => row.id);
    if (postIds.length === 0) {
      return [];
    }

    // lekérdezzük a posztokat a kommentekkel együtt, és visszaadjuk
    const [rows] = await connection.query(
      `SELECT p.id, p.title, p.content, p.labels, p.created_at, p.user_id, p.video_link, p.files,
        JSON_ARRAYAGG(
          CASE
            WHEN c.id IS NOT NULL THEN JSON_OBJECT(
              'id', c.id,
              'content', c.content,
              'created_at', c.created_at,
              'user_id', c.user_id
            )
            ELSE JSON_OBJECT('content', NULL)
          END
        ) AS comments
      FROM posts p
      LEFT JOIN comments c ON c.post_id = p.id
      WHERE p.id IN (?)
      GROUP BY p.id
      ORDER BY p.created_at DESC`,
      [postIds]
    );
    await connection.commit();
    console.log("Posztok csoportonkénti lekérdezésének tranzakciója sikeres.");
    return rows;
  } catch (err) {
    await connection.rollback();
    console.error(
      "Posztok csoportonkénti lekérdezésének tranzakciója sikertelen!",
      err
    );
  } finally {
    connection.release();
  }
  return resultPosts;
}

export async function createPost(
  title,
  content,
  visibility,
  labels,
  userId,
  fileInfos,
  videoLink
) {
  const connection = await pool.getConnection();
  let insertedPostId;
  try {
    const [result] = await connection.query(
      `INSERT INTO posts (title, content, visibility, labels, user_id, video_link, files)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        content,
        visibility,
        labels,
        userId,
        videoLink,
        JSON.stringify(fileInfos),
      ]
    );
    insertedPostId = result.insertId;
    connection.release();
    try {
      const newPost = await getPost(insertedPostId);
      return newPost;
    } catch (e) {
      throw new Error(e.message);
    }
  } catch (e) {
    throw new Error(e.message);
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

export async function deletePost(id) {
  const connection = await pool.getConnection();
  try {
    const [results] = await connection.query(`DELETE FROM posts WHERE id = ?`, [
      id,
    ]);
    if (results.affectedRows === 1) {
      return true;
    } else {
      console.warn("A törlendő poszt nem található");
      return true;
    }
  } catch (error) {
    console.error("SQL hiba: ", error);
    return false;
  } finally {
    connection.release();
  }
}

export async function getUserById(id) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT username FROM users WHERE id = ?`,
    [id]
  );
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

export async function getAdminUser() {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    "SELECT * FROM users WHERE role = ADMIN"
  );
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

export async function updateUsername(userId, newUsername) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `UPDATE users SET username = ? WHERE id = ?`,
    [newUsername, userId]
  );
  return [rows];
}

export async function updatePassword(userId, newPassword) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `UPDATE users SET password = ? WHERE id = ?`,
    [newPassword, userId]
  );
  return [rows];
}

export async function getAllGroups() {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    "SELECT groups_nexus.id, groups_nexus.name, groups_nexus.description FROM groups_nexus"
  );
  connection.release();
  return rows;
}

export async function getGroupsOfUser(userId) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT groups_nexus.id, groups_nexus.name FROM user_groups
    JOIN groups_nexus ON user_groups.group_id=groups_nexus.id WHERE user_id = ?`,
    [userId]
  );
  connection.release();
  return rows;
}

export async function getUsersOfGroup(groupId) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT users.id, users.username, users.role FROM user_groups
    JOIN users ON user_groups.user_id=users.id WHERE group_id = ?`,
    [groupId]
  );
  connection.release();
  return rows;
}

export async function getGroup(id) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT * FROM groups_nexus WHERE id = ?`,
    [id]
  );
  connection.release();
  return rows[0];
}

export async function getGroupByName(groupName) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT * FROM groups_nexus WHERE name = ?`,
    [groupName]
  );
  connection.release();
  return rows[0];
}

export async function createGroup(name, description, userId) {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      `INSERT INTO groups_nexus (name, description, created_by) VALUES (?, ?, ?)`,
      [name, description, userId]
    );
    const insertedGroupId = result.insertId;
    connection.release();
    try {
      const newGroup = await getGroup(insertedGroupId);
      return newGroup;
    } catch (e) {
      throw new Error(e.message);
    }
  } catch (e) {
    throw new Error(e.message);
  } finally {
    connection.release();
  }
}

export async function mapUserToGroup(userId, groupId) {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      `INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)`,
      [userId, groupId]
    );
    const id = result.insertId;
    return "Felhasználó csoporthoz rendelése sikeres";
  } catch (e) {
    throw new Error(e.message);
  } finally {
    connection.release();
  }
}

export async function mapUsersToGroup(groupId, userIds) {
  const connection = await pool.getConnection();
  try {
    userIds.forEach(async (userId) => {
      await connection.query(
        `INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)`,
        [userId, groupId]
      );
    });
    return "Felhasználók csoporthoz rendelése sikeres";
  } catch (e) {
    throw new Error(e.message);
  } finally {
    connection.release();
  }
}

export async function getPostsOfGroups(groupIds) {
  if (groupIds) {
    const connection = await pool.getConnection();
    try {
      let groupIdsWithPostIds = [];
      groupIds.forEach(async (groupId) => {
        const [postRows] = await connection.query(
          `SELECT post_id
          FROM post_groups
          WHERE group_id = ?`,
          [groupId]
        );
        groupIdsWithPostIds.push({
          groupId,
          postIds: postRows.map((row) => row.post_id),
        });
      });
      return groupIdsWithPostIds;
    } catch (e) {
      throw new Error(e.message);
    } finally {
      connection.release();
    }
  } else {
    return undefined;
  }
}

export async function addUserToGroup(userId, groupId) {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      `INSERT INTO user_groups VALUES (?, ?)`,
      [userId, groupId]
    );
    connection.release();
    const id = result.insertId;
    return await getCommentById(id);
  } catch (e) {
    throw new Error(e.message);
  }
}

export async function deleteUserFromGroup(userId, groupId) {
  const connection = await pool.getConnection();
  try {
    const [results] = await connection.query(
      `DELETE FROM user_groups WHERE user_id = ? AND group_id = ?`,
      [userId, groupId]
    );
    if (results.affectedRows === 1) {
      return true;
    } else {
      console.warn("A törlendő felhasználó vagy a csoport nem található");
      return true;
    }
  } catch (error) {
    console.error("SQL hiba: ", error);
    return false;
  } finally {
    connection.release();
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

export async function deleteComment(id) {
  const connection = await pool.getConnection();
  try {
    const [results] = await connection.query(
      `DELETE FROM comments WHERE id = ?`,
      [id]
    );
    if (results.affectedRows === 1) {
      return true;
    } else {
      console.warn("A törlendő komment nem található");
      return true;
    }
  } catch (error) {
    console.error("SQL hiba: ", error);
    return false;
  } finally {
    connection.release();
  }
}
