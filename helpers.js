import * as queries from "./database.js";

export async function findUserByEmail(email) {
  const user = await queries.getUserByEmail(email);
  if (!user) {
    return undefined;
  } else {
    return user;
  }
}

export async function findUserByName(username) {
  const user = await queries.getUserByName(username);
  if (!user) {
    return undefined;
  } else {
    return user;
  }
}

export async function findUserById(id) {
  const user = await queries.getUserById(id);
  if (!user) {
    return undefined;
  } else {
    return user.username;
  }
}

export async function addUser(username, email, password, role) {
  const user = await queries.createUser(username, email, password, role);
  if (!user) {
    throw new Error("Új felhasználó létrehozása sikertelen!");
  } else {
    return user;
  }
}

export async function addPost(
  title,
  content,
  isPublic,
  labels,
  userId,
  selectedGroupIds,
  videoLink,
  fileInfos,
  teachersOnly
) {
  try {
    if (isPublic) {
      const newPublicPost = await queries.createPost(
        title,
        content,
        "PUBLIC",
        labels,
        userId,
        videoLink,
        fileInfos,
        teachersOnly
      );
      if (!newPublicPost) {
        throw new Error("Publikus poszt létrehozása sikertelen!");
      }
      return;
    } else {
      const newPost = await queries.createPost(
        title,
        content,
        "PRIVATE",
        labels,
        userId,
        videoLink,
        fileInfos,
        teachersOnly
      );
      const newPostId = newPost.id;
      const mapSuccess = await queries.mapGroupsToPost(
        newPostId,
        selectedGroupIds
      );
      if (!mapSuccess) {
        throw new Error("Poszt csoportokhoz rendelése sikertelen!");
      }
      return;
    }
  } catch (e) {
    throw new Error(e.message);
  }
}

export async function getAllGroups() {
  const allGroups = await queries.getAllGroups();
  if (allGroups) {
    return allGroups;
  } else {
    return undefined;
  }
}

export async function getGroupsOfUser(username) {
  const foundUser = await findUserByName(username);
  if (foundUser) {
    const userId = foundUser.id;
    const groupsOfUser = await queries.getGroupsOfUser(userId);
    return groupsOfUser;
  } else {
    return undefined;
  }
}

export async function getUsersOfGroup(groupId) {
  if (groupId) {
    const usersOfGroup = await queries.getUsersOfGroup(groupId);
    return usersOfGroup;
  } else {
    return undefined;
  }
}

export async function addUsersToGroup(groupName, usersToAdd) {
  const group = await queries.getGroupByName(groupName);
  if (!group) {
    throw new Error("A megadott csoport nem található!");
  }
  const users = [];
  for (const username of usersToAdd) {
    const user = await queries.getUserByName(username);
    if (!user) {
      throw new Error(
        `Legalább az egyik megadott felhasználó nem található: ${username}`
      );
    }
    users.push(user);
  }

  if (group.teachers_only) {
    for (const user of users) {
      if (user.role !== "TEACHER" && user.role !== "ADMIN") {
        throw new Error(
          "A csoporthoz csak tanárt vagy admint lehet hozzáadni! Egy vagy több felhasználónak nincs megfelelő jogosultsága."
        );
      }
    }
  }
  const userIds = users.map((user) => user.id);
  await queries.mapUsersToGroup(group.id, userIds);
  return;
}

export async function removeUsersFromGroup(groupId) {
  if (groupId) {
    const usersOfGroup = await queries.getUsersOfGroup(groupId);
    return usersOfGroup;
  } else {
    return undefined;
  }
}

export async function addGroup(name, description, teachersOnly, userId) {
  // Ellenőrizzük, hogy létezik-e már ilyen nevű csoport
  const existingGroup = await queries.getGroupByName(name);
  if (existingGroup) {
    throw new Error("A megadott csoportnév már foglalt!");
  }
  const group = await queries.createGroup(
    name,
    description,
    teachersOnly === true ? 1 : 0,
    userId
  );
  if (group) {
    const adminUser = await queries.getAdminUser();
    if (adminUser) {
      await queries.mapUserToGroup(adminUser.id, group.id);
    } else {
      throw new Error("Admin felhasználó nem található!");
    }
    if (userId !== adminUser.id) {
      await queries.mapUserToGroup(userId, group.id);
    }
  } else {
    throw new Error("Csoport létrehozása sikertelen!");
  }

  return group;
}

export async function getPostsWithComments(userName) {
  // lekérdezzük, hogy a frontendről érkező felhasználó létezik-e
  const foundUser = await findUserByName(userName);
  const userId = foundUser.id;
  const userRole = foundUser.role;

  if (userId) {
    let resultPosts = undefined;
    // ha létezik a felhasználó, lekérdezzük, milyen csoportokban van benne
    const groupsOfUser = await getGroupsOfUser(userName);
    // kinyerjük a csoportok id-jait
    const groupIds = Object.values(groupsOfUser).map((group) => group.id);

    const groupIdsWithPostIds = await queries.getPostsOfGroups(groupIds);

    if (userRole === "TEACHER" || userRole === "ADMIN") {
      // ha tanár vagy admin, akkor lekérdezzük az összes csoportot
      resultPosts = await queries.getAllPostsWithComments();
      if (resultPosts) {
        handleEmptyComments(resultPosts);
        const readyPosts = await getUserNameForPostAndComments(resultPosts);
        return { readyPosts, groupsOfUser, groupIdsWithPostIds };
      } else {
        throw new Error("Posztok és kommentek lekérdezése sikertelen!");
      }
    }

    const publicPosts = await queries.getPublicPostsWithComments();
    // a csoportId-k alapján lekérdezzük a posztokat
    let privatePostsWithComments = [];
    if (groupsOfUser.length > 0) {
      privatePostsWithComments = await queries.getPostsWithCommentsByUserGroups(
        groupIds
      );
    }
    if (privatePostsWithComments && publicPosts) {
      // összefűzzük a publikus posztokat a privát posztokkal
      resultPosts = privatePostsWithComments.concat(publicPosts);
      // az eredményül kapott listát dátum szerint csökkenő sorrendbe rendezzük (legújabb legfelül)
      resultPosts.sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    if (resultPosts) {
      handleEmptyComments(resultPosts);
      const readyPosts = await getUserNameForPostAndComments(resultPosts);
      return { readyPosts, groupsOfUser, groupIdsWithPostIds };
    } else if (privatePostsWithComments) {
      handleEmptyComments(privatePostsWithComments);
      const readyPosts = await getUserNameForPostAndComments(
        privatePostsWithComments
      );
      return { readyPosts, groupsOfUser, groupIdsWithPostIds };
    } else if (publicPosts) {
      handleEmptyComments(publicPosts);
      const readyPosts = await getUserNameForPostAndComments(publicPosts);
      return { readyPosts, groupsOfUser, groupIdsWithPostIds };
    } else {
      throw new Error("Posztok és kommentek lekérdezése sikertelen!");
    }
  } else {
    throw new Error("Felhasználó lekérdezése sikertelen!");
  }
}

// az üres kommenteket null értékekkel feltöltve adja vissza az adatbázis query,
// ezért az ilyen "üres" komment objektumokat kicseréljük üres tömbre, hogy könnyebben tudjuk kezelni frontenden
function handleEmptyComments(posts) {
  posts.forEach((post) => {
    if (post.comments[0].content === null) {
      post.comments = [];
    }
  });
  return;
}

async function getUserNameForPostAndComments(posts) {
  const updatedPosts = await Promise.all(
    posts.map(async (post) => {
      const username = await getUserNameById(post.user_id);

      const updatedComments = await Promise.all(
        (post.comments || []).map(async (comment) => {
          const commentUsername = await getUserNameById(comment.user_id);
          return { ...comment, username: commentUsername };
        })
      );

      return { ...post, username, comments: updatedComments };
    })
  );

  return updatedPosts;
}

async function getUserNameById(userId) {
  return await findUserById(userId).then((user) => {
    if (user) {
      return user;
    } else {
      throw new Error("A poszt felhasználója nem található!");
    }
  });
}

export async function changeUsername(userId, newUsername) {
  const updatedUser = await queries.updateUsername(userId, newUsername);
  if (!updatedUser) {
    throw new Error("A felhasználónév módosítása sikertelen!");
  }
  return updatedUser;
}

export async function changePassword(userId, newPassword) {
  const updatedUser = await queries.updatePassword(userId, newPassword);
  if (!updatedUser) {
    throw new Error("A jelszó módosítása sikertelen!");
  }
  return updatedUser;
}
