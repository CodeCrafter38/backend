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
  selectedGroups
) {
  try {
    const newPost = await queries.createPost(title, content, isPublic, userId);
    const newPostId = newPost.id;
    const mapSuccess = await queries.mapGroupsToPost(newPostId, selectedGroups);
    if (!mapSuccess) {
      throw new Error("Poszt csoportokhoz rendelése sikertelen!");
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

export async function getPostsWithComments() {
  const postsWithComments = await queries.getPostsWithComments();
  if (postsWithComments) {
    const postsMap = new Map();
    postsWithComments.forEach((row) => {
      if (!postsMap.has(row.postId)) {
        postsMap.set(row.postId, {
          id: row.postId,
          title: row.title,
          content: row.postContent,
          comments: [],
        });
      }
      if (row.commentId) {
        postsMap.get(row.postId).comments.push({
          id: row.commentId,
          content: row.commentContent,
        });
      }
    });

    const posts = Array.from(postsMap.values());
    return posts;
  } else {
    throw new Error("Posztok és kommentek lekérdezése sikertelen!");
  }
}
