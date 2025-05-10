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
    if (isPublic) {
      const newPublicPost = await queries.createPost(
        title,
        content,
        "PUBLIC",
        userId
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
        userId
      );
      const newPostId = newPost.id;
      const mapSuccess = await queries.mapGroupsToPost(
        newPostId,
        selectedGroups
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
  const foundUser = await findUserByName(userName);
  const userId = foundUser.id;
  if (userId) {
    const publicPosts = await queries.getPublicPostsWithComments();
    const postsWithComments = await queries.getPostsWithCommentsByUserGroups(
      userId
    );
    if (postsWithComments && publicPosts) {
      allFetchedPosts = postsWithComments.concat(publicPosts);
    }
    if (allFetchedPosts) {
      handleEmptyComments(allFetchedPosts);
      return allFetchedPosts;
    } else if (postsWithComments) {
      handleEmptyComments(postsWithComments);
      return postsWithComments;
    } else if (publicPosts) {
      handleEmptyComments(publicPosts);
      return postsWithComments;
    } else {
      throw new Error("Posztok és kommentek lekérdezése sikertelen!");
    }
  } else {
    throw new Error("Felhasználó lekérdezése sikertelen!");
  }
}

function handleEmptyComments(posts) {
  posts.forEach((post) => {
    if (post.comments[0].content === null) {
      post.comments = [];
    }
  });
  return;
}
