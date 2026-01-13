import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql
  .createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: false,
  })
  .promise();

export async function getPosts() {
  try {
    const [rows] = await pool.execute("SELECT * FROM posts");
    return rows;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getPost(id) {
  // prepared statement (előkészített utasítás), a felhasználó által megadott értékeket
  // az sql query-től külön küldjük be, és előfeldolgozza az adatbázis-engine az sql-injection elleni védelemhez
  try {
    const [rows] = await pool.execute(`SELECT * FROM posts WHERE id = ?`, [id]);
    return rows[0];
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getAllPostsWithComments() {
  try {
    const [rows] = await pool.execute(
      "SELECT p.id, p.title, p.content, p.labels, p.created_at, p.user_id, p.video_link, p.files, p.teachers_only, JSON_ARRAYAGG(CASE WHEN c.id IS NOT NULL THEN JSON_OBJECT('id',c.id, 'content',c.content, 'created_at',c.created_at, 'user_id',c.user_id) ELSE JSON_OBJECT('content', NULL) END ) AS comments FROM posts p LEFT JOIN comments c ON c.post_id = p.id GROUP BY p.id ORDER BY p.created_at DESC"
    );
    return rows;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getPublicPostsWithComments() {
  try {
    const [rows] = await pool.execute(
      "SELECT p.id, p.title, p.content, p.labels, p.created_at, p.user_id, p.video_link, p.files, p.teachers_only, JSON_ARRAYAGG(CASE WHEN c.id IS NOT NULL THEN JSON_OBJECT('id',c.id, 'content',c.content, 'created_at',c.created_at, 'user_id',c.user_id) ELSE JSON_OBJECT('content', NULL) END ) AS comments FROM posts p LEFT JOIN comments c ON c.post_id = p.id WHERE p.visibility = 'PUBLIC' GROUP BY p.id ORDER BY p.created_at DESC"
    );
    return rows;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getPostsWithCommentsByUserGroups(groupIds) {
  if (!groupIds?.length) return [];
  const resultPosts = [];
  // lekérdezzük a felhasználó csoportjai alapján az összes posztot, minden posztot csak egyszer (distinct)
  try {
    const [postRows] = await pool.execute(
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
    const [rows] = await pool.execute(
      `SELECT p.id, p.title, p.content, p.labels, p.created_at, p.user_id, p.video_link, p.files, p.teachers_only,
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
    console.log("Posztok csoportonkénti lekérdezése sikeres.");
    return rows;
  } catch (err) {
    console.error("Posztok csoportonkénti lekérdezése sikertelen!", err);

    return resultPosts;
  }
}

export async function createPost(
  title,
  content,
  visibility,
  labels,
  userId,
  videoLink,
  fileInfos,
  teachersOnly
) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO posts (title, content, visibility, labels, user_id, video_link, files, teachers_only)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        content,
        visibility,
        labels,
        userId,
        videoLink,
        JSON.stringify(fileInfos),
        teachersOnly,
      ]
    );

    return await getPost(result.insertId);
  } catch (e) {
    throw new Error(e.message);
  }
}

export async function mapGroupsToPost(postId, groupIds) {
  if (!groupIds?.length) return true;

  try {
    await Promise.all(
      groupIds.map((groupId) =>
        pool.execute(
          "INSERT INTO post_groups (post_id, group_id) VALUES (?, ?)",
          [postId, groupId]
        )
      )
    );
    return true;
  } catch (e) {
    throw new Error(e.message);
  }
}

export async function deletePost(id) {
  try {
    const [results] = await pool.execute(`DELETE FROM posts WHERE id = ?`, [
      id,
    ]);
    if (results.affectedRows === 1) {
      return true;
    } else {
      console.warn("A törlendő poszt nem található");
      return true;
    }
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getUserById(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT username FROM users WHERE id = ?`,
      [id]
    );
    return rows[0];
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getUserByName(username) {
  // TODO: case sensitive username keresés - BINARY megoldással - doksiban kifejteni
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM users WHERE BINARY username = BINARY ?`,
      [username]
    );
    return rows[0];
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getUserByEmail(email) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM users WHERE email = ?`, [
      email,
    ]);
    return rows[0];
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getAdminUser() {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE `role` = ? LIMIT 1",
      ["ADMIN"]
    );
    return rows[0] ?? null;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function addProfilePicture(userid, file) {
  try {
    const fileInfo = JSON.stringify(file);
    const [result] = await pool.execute(
      `UPDATE users SET profile_picture = ? WHERE id = ?`,
      [fileInfo, userid]
    );
    return result;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function createUser(username, email, password, role) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
      [username, email, password, role]
    );
    return await getUserById(result.insertId);
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function updateUsername(userId, newUsername) {
  try {
    const [result] = await pool.execute(
      `UPDATE users SET username = ? WHERE id = ?`,
      [newUsername, userId]
    );
    return [result];
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function updatePassword(userId, newPassword) {
  const [result] = await pool.execute(
    `UPDATE users SET password = ? WHERE id = ?`,
    [newPassword, userId]
  );
  return [result];
}

export async function getAllGroups() {
  try {
    const [rows] = await pool.execute(
      "SELECT groups_nexus.id, groups_nexus.name, groups_nexus.description, groups_nexus.created_at, groups_nexus.created_by, groups_nexus.teachers_only FROM groups_nexus"
    );
    return rows;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getGroupsOfUser(userId) {
  try {
    const [rows] = await pool.execute(
      `SELECT groups_nexus.id, groups_nexus.name, groups_nexus.description, groups_nexus.created_at, groups_nexus.created_by, groups_nexus.teachers_only FROM user_groups
    JOIN groups_nexus ON user_groups.group_id=groups_nexus.id WHERE user_id = ?`,
      [userId]
    );
    return rows;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getUsersOfGroup(groupId) {
  try {
    const [rows] = await pool.execute(
      `SELECT users.id, users.username, users.role FROM user_groups
    JOIN users ON user_groups.user_id=users.id WHERE group_id = ?`,
      [groupId]
    );
    return rows;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getGroup(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM groups_nexus WHERE id = ?`,
      [id]
    );
    return rows[0];
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getGroupByName(groupName) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM groups_nexus WHERE name = ?`,
      [groupName]
    );
    return rows[0];
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function createGroup(name, description, teachersOnly, userId) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO groups_nexus (name, description, teachers_only, created_by) VALUES (?, ?, ?, ?)`,
      [name, description, teachersOnly, userId]
    );

    return await getGroup(result.insertId);
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function deleteGroup(id) {
  try {
    const [results] = await pool.execute(
      `DELETE FROM groups_nexus WHERE id = ?`,
      [id]
    );
    if (results.affectedRows === 1) {
      return true;
    } else {
      console.warn("A törlendő csoport nem található");
      return true;
    }
  } catch (error) {
    throw new Error(e.message, { cause: e });
  }
}

export async function mapUserToGroup(userId, groupId) {
  if (!userId?.length) return "Felhasználó csoporthoz rendelése sikeres";
  try {
    await pool.execute(
      `INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)`,
      [userId, groupId]
    );
    return "Felhasználó csoporthoz rendelése sikeres";
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function mapUsersToGroup(groupId, userIds) {
  if (!userIds?.length) return "Felhasználók csoporthoz rendelése sikeres";
  try {
    await Promise.all(
      userIds.map((userId) =>
        pool.execute(
          "INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)",
          [userId, groupId]
        )
      )
    );
    return "Felhasználók csoporthoz rendelése sikeres";
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getPostsOfGroups(groupIds) {
  if (!groupIds?.length) return undefined;

  try {
    const results = await Promise.all(
      groupIds.map(async (groupId) => {
        const [postRows] = await pool.execute(
          "SELECT post_id FROM post_groups WHERE group_id = ?",
          [groupId]
        );
        return { groupId, postIds: postRows.map((r) => r.post_id) };
      })
    );
    return results;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function deleteUserFromGroup(userId, groupId) {
  try {
    const [results] = await pool.execute(
      `DELETE FROM user_groups WHERE user_id = ? AND group_id = ?`,
      [userId, groupId]
    );
    if (results.affectedRows === 1) {
      return true;
    } else {
      console.warn("A törlendő felhasználó vagy a csoport nem található");
      return true;
    }
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getComments() {
  try {
    const [rows] = await pool.execute("SELECT * FROM comments");
    return rows;
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function getCommentById(id) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM comments WHERE id = ?`, [
      id,
    ]);
    return rows[0];
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function createComment(content, postId, userId) {
  try {
    const [result] = await pool.execute(
      "INSERT INTO comments (content, post_id, user_id) VALUES (?, ?, ?)",
      [content, postId, userId]
    );
    return await getCommentById(result.insertId);
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}

export async function deleteComment(id) {
  try {
    const [results] = await pool.execute(`DELETE FROM comments WHERE id = ?`, [
      id,
    ]);
    if (results.affectedRows === 1) {
      return true;
    } else {
      console.warn("A törlendő komment nem található");
      return true;
    }
  } catch (e) {
    throw new Error(e.message, { cause: e });
  }
}
