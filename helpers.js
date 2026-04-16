// Helpers réteg: a routerek/strategy-k általában nem közvetlenül a queries-t hívják,
// hanem ezen a köztes rétegen keresztül mennek át a kérések.
// Előny:
// - egységes hibakezelés
// - logika központosítása (pl. poszt létrehozás, mapping)
// - könnyebb tesztelés (a helper mockolható a router tesztekben)

import * as queries from "./database.js";

export async function findUserByEmail(email) {
  // Visszaadjuk a teljes user objektumot (ahogy a DB query visszaadja),
  // vagy undefined-ot, ha nincs találat.
  // Javítási lehetőség: return user ?? undefined;
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
  // Itt nem a teljes user-t adjuk vissza, hanem csak a username-t.
  // Ez akkor praktikus, ha posztokhoz vagy kommentekhez név kell, nem teljes user profil.
  // Javítási lehetőség: a függvény neve alapján inkább teljes user-t várnánk
  const user = await queries.getUserById(id);
  if (!user) {
    return undefined;
  } else {
    return user.username;
  }
}

export async function addUser(username, email, password, role) {
  // createUser mögött kell lennie DB oldali constraint-nek (kényszerítés):
  // - email legyen UNIQUE
  // - username legyen UNIQUE
  // így race condition (versenyhelyzet) esetén is jól működik
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
  teachersOnly,
) {
  try {
    // Itt két külön poszt-típus logika van:
    // - PUBLIC: nem mappeljük csoportokhoz
    // - PRIVATE: poszt létrehozás után mappeljük a selectedGroupIds alapján
    if (isPublic) {
      const newPublicPost = await queries.createPost(
        title,
        content,
        "PUBLIC",
        labels,
        userId,
        videoLink,
        fileInfos,
        teachersOnly,
      );
      if (!newPublicPost) {
        throw new Error("Publikus poszt létrehozása sikertelen!");
      }
      // Itt return; -> nem adunk vissza konkrét post objektumot.
      // Ha a frontend később "azonnal" szeretné látni az új posztot,
      // akkor most újra lekérdezünk, de itt is vissza lehetne adni.
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
        teachersOnly,
      );

      // PRIVATE poszt: a csoport mapping bekerül a kapcsolótáblába.
      const newPostId = newPost.id;

      // Megjegyzés: itt selectedGroupIds-t validálni kellene (int list),
      // különben DB oldalon kaphatunk foreign key hibát.
      const mapSuccess = await queries.mapGroupsToPost(
        newPostId,
        selectedGroupIds,
      );
      if (!mapSuccess) {
        throw new Error("Poszt csoportokhoz rendelése sikertelen!");
      }
      return;
    }
  } catch (e) {
    // Itt tovább dobjuk az error message-t.
    // Megjegyzés: e.message akkor biztonságos, ha e biztosan Error típusú.
    // (Ha valaki stringet dob, az e.message lehet undefined.)
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
  // Kétlépcsős logika: username -> userId -> csoportok.
  // A csoport membership a DB-ben userId-hez kötött.
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
  // Egyszerű passthrough.
  // Javítási lehetőség: groupId-t érdemes int-re validálni router szinten, de itt is védjük null ellen.
  if (groupId) {
    const usersOfGroup = await queries.getUsersOfGroup(groupId);
    return usersOfGroup;
  } else {
    return undefined;
  }
}

export async function addUsersToGroup(groupName, usersToAdd) {
  // 1) Az adott csoport megkeresése csoportnév alapján
  const group = await queries.getGroupByName(groupName);
  if (!group) {
    throw new Error("A megadott csoport nem található!");
  }

  // 2) A felhasználókat egyenként validáluk, és összegyűjtjük.
  // Itt lehetne optimalizálni úgy, hogy: "WHERE username IN (...)",
  // de a jelenlegi forma könnyen olvasható és egyszerű.
  const users = [];
  for (const username of usersToAdd) {
    const user = await queries.getUserByName(username);
    if (!user) {
      throw new Error(
        `Legalább az egyik megadott felhasználó nem található: ${username}`,
      );
    }
    users.push(user);
  }

  // 3) teachers_only csoport: csak TEACHER-t vagy ADMIN-t engedünk be.
  // Ez egy RBAC (Role-based access control) szabály: a tanári csoport védett.
  if (group.teachers_only) {
    for (const user of users) {
      if (user.role !== "TEACHER" && user.role !== "ADMIN") {
        throw new Error(
          "A csoporthoz csak tanárt vagy admint lehet hozzáadni! Egy vagy több felhasználónak nincs megfelelő jogosultsága.",
        );
      }
    }
  }

  // 4) Mapping a kapcsolótáblába.
  const userIds = users.map((user) => user.id);
  await queries.mapUsersToGroup(group.id, userIds);
  return;
}

export async function addGroup(name, description, teachersOnly, userId) {
  // 1) Név ütközés ellenőrzés
  // Fontos: DB oldalon is UNIQUE (name), különben versenyhelyzetnél lehet probléma.
  const existingGroup = await queries.getGroupByName(name);
  if (existingGroup) {
    throw new Error("A megadott csoportnév már foglalt!");
  }

  // 2) Létrehozás. teachersOnly-t 1 vagy 0 értékre konvertáljuk (MySQL tinyint(1)).
  const group = await queries.createGroup(
    name,
    description,
    teachersOnly === true ? 1 : 0,
    userId,
  );

  if (group) {
    // 3) Admin automatikus hozzáadása a csoporthoz.
    // Az admin mindenhol jelen van, tud moderálni.
    const adminUser = await queries.getAdminUser();
    if (adminUser) {
      await queries.mapUserToGroup(adminUser.id, group.id);
    } else {
      throw new Error("Admin felhasználó nem található!");
    }

    // 4) A létrehozó user is bekerül a csoportba (ha nem admin).
    if (userId !== adminUser.id) {
      await queries.mapUserToGroup(userId, group.id);
    }
  } else {
    throw new Error("Csoport létrehozása sikertelen!");
  }

  return group;
}

export async function getPostsWithComments(userName) {
  // Fő feed összerakása:
  // - user + role meghatározás
  // - user csoportjai
  // - a tanár és admin mindent lát, a diákok csak a publikus posztokat, és a privát posztokat látják a saját csoportjaikból
  // - a kommentekben user_id alapján username feloldás

  const foundUser = await findUserByName(userName);
  const userId = foundUser.id;
  const userRole = foundUser.role;

  if (userId) {
    let resultPosts = undefined;

    // user csoportjai
    const groupsOfUser = await getGroupsOfUser(userName);

    // group ids kinyerése (a queries tömböt ad vissza, itt Object.values-szal védjük a formátumot)
    const groupIds = Object.values(groupsOfUser).map((group) => group.id);

    // a user csoportjaihoz tartozó posztId-k összegíűjtése (a frontend oldali jelölésekhez)
    const groupIdsWithPostIds = await queries.getPostsOfGroups(groupIds);

    if (userRole === "TEACHER" || userRole === "ADMIN") {
      // Tanár/admin: teljes feed (minden csoport + publikus + privát posztok)
      resultPosts = await queries.getAllPostsWithComments();
      if (resultPosts) {
        handleEmptyComments(resultPosts);
        const readyPosts = await getUserNameForPostAndComments(resultPosts);
        return { readyPosts, groupsOfUser, groupIdsWithPostIds };
      } else {
        throw new Error("Posztok és kommentek lekérdezése sikertelen!");
      }
    }

    // Diák: publikus + privát posztok a saját csoportjaiból
    const publicPosts = await queries.getPublicPostsWithComments();

    let privatePostsWithComments = [];
    if (groupsOfUser.length > 0) {
      privatePostsWithComments =
        await queries.getPostsWithCommentsByUserGroups(groupIds);
    }

    // Összemerge-ölés + rendezés a created_at mező alapján csökkenő sorrendben (desc)
    if (privatePostsWithComments && publicPosts) {
      resultPosts = privatePostsWithComments.concat(publicPosts);
      resultPosts.sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }

    // A következő ágak redundánsak, de olvashatóak: mindig visszaadjuk, ami épp elérhető.
    // Javítási lehetőség: ismétlődő kódok csökkentése
    if (resultPosts) {
      handleEmptyComments(resultPosts);
      const readyPosts = await getUserNameForPostAndComments(resultPosts);
      return { readyPosts, groupsOfUser, groupIdsWithPostIds };
    } else if (privatePostsWithComments) {
      handleEmptyComments(privatePostsWithComments);
      const readyPosts = await getUserNameForPostAndComments(
        privatePostsWithComments,
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

// Az adatbázis join esetén sokszor így jön vissza a komment tömb:
// comments: [{ content: null, ... }]
// Ez frontend szempontból rossz, mert úgy néz ki, mintha lenne komment.
// Itt normalizáljuk ezeket üres tömbre.
function handleEmptyComments(posts) {
  posts.forEach((post) => {
    if (post.comments[0].content === null) {
      post.comments = [];
    }
  });
  return;
}

async function getUserNameForPostAndComments(posts) {
  // Promise.all: párhuzamosítjuk a username feloldásokat, így gyorsabb, mint sorban awaitelni.
  // Viszont sok poszt/komment esetén ez az N+1 lekérdezés problémát okozhat DB oldalon.
  // Javítási lehetőség: általában ezt lehet optimalizálni egy join-nal vagy batch lekérdezéssel.
  const updatedPosts = await Promise.all(
    posts.map(async (post) => {
      const username = await getUserNameById(post.user_id);

      const updatedComments = await Promise.all(
        (post.comments || []).map(async (comment) => {
          const commentUsername = await getUserNameById(comment.user_id);
          return { ...comment, username: commentUsername };
        }),
      );

      return { ...post, username, comments: updatedComments };
    }),
  );

  return updatedPosts;
}

async function getUserNameById(userId) {
  // a findUserById itt már username-t ad vissza.
  // then(...) blokkal dobjuk a hibát, ha nincs user.
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
  // Itt az új jelszó már hash-elt stringként érkezik a routerből (auth.js).
  // Így a helper nem foglalkozik hash-eléssel, csak DB update-tel.
  const updatedUser = await queries.updatePassword(userId, newPassword);
  if (!updatedUser) {
    throw new Error("A jelszó módosítása sikertelen!");
  }
  return updatedUser;
}

export async function saveUserTheme(userId, themeMode, themePalette) {
  return await queries.updateUserTheme(userId, themeMode, themePalette);
}
