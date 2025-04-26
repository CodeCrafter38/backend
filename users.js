import * as queries from "./database.js";

const users = [];

export async function findUserByEmail(email) {
  const user = await queries.getUserByEmail(email);
  if (!user) {
    return undefined;
  } else {
    return user;
  }
}

export function addUser(username, email, password, role) {
  queries.createUser(username, email, password, role);
}

export { users };
