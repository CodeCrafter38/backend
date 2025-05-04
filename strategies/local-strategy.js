import { Strategy } from "passport-local";
import bcrypt from "bcrypt";
import { findUserByEmail } from "../helpers.js";

export default function initialize(passport) {
  passport.use(
    new Strategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const foundUser = await findUserByEmail(email);
        if (!foundUser) throw new Error("User not found");
        if (
          await bcrypt.compare(String(password), String(foundUser.password))
        ) {
          done(null, foundUser);
        } else {
          throw new Error("Incorrect username or password");
        }
      } catch (e) {
        done(e, null);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.email));

  passport.deserializeUser(async (email, done) => {
    try {
      const user = findUserByEmail(email);
      done(null, user);
    } catch (e) {
      done(e, null);
    }
  });
}
