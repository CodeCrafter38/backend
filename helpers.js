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
    throw new Error("Failed to create new user!");
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
      throw new Error("Failed to map groups to new post!");
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
