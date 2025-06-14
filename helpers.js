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
  userId,
  isPublic,
  selectedGroupIds,
  fileInfos,
  videoLink
) {
  try {
    if (isPublic) {
      const newPublicPost = await queries.createPost(
        title,
        content,
        "PUBLIC",
        userId,
        fileInfos,
        videoLink
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
        userId,
        fileInfos,
        videoLink
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

export async function getPostsWithComments(userName) {
  let allFetchedPosts = [];
  // lekérdezzük, hogy a frontendről érkező felhasználó létezik-e
  const foundUser = await findUserByName(userName);
  const userId = foundUser.id;

  if (userId) {
    // ha létezik a felhasználó, lekérdezzük, milyen csoportokban van benne
    const groupsOfUser = await getGroupsOfUser(userName);
    // kinyerjük a csoportok id-jait
    const groupIds = Object.values(groupsOfUser).map((group) => group.id);

    const publicPosts = await queries.getPublicPostsWithComments();
    // a csoportId-k alapján lekérdezzük a posztokat
    const privatePostsWithComments =
      await queries.getPostsWithCommentsByUserGroups(groupIds);
    if (privatePostsWithComments && publicPosts) {
      // összefűzzük a publikus posztokat a privát posztokkal
      allFetchedPosts = privatePostsWithComments.concat(publicPosts);
      // az eredményül kapott listát dátum szerint csökkenő sorrendbe rendezzük (legújabb legfelül)
      allFetchedPosts.sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    if (allFetchedPosts) {
      handleEmptyComments(allFetchedPosts);
      return allFetchedPosts;
    } else if (privatePostsWithComments) {
      handleEmptyComments(privatePostsWithComments);
      return privatePostsWithComments;
    } else if (publicPosts) {
      handleEmptyComments(publicPosts);
      return publicPosts;
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
