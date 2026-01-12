import { Strategy } from "passport-local";
import bcrypt from "bcrypt";
import { findUserByEmail } from "../helpers.js";

export default function initialize(passport) {
  passport.use(
    new Strategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const foundUser = await findUserByEmail(email);

        if (!foundUser) {
          return done(null, false, {
            message: "Felhasználónév vagy jelszó nem egyezik!",
          });
        }

        const ok = await bcrypt.compare(
          String(password),
          String(foundUser.password)
        );
        if (!ok) {
          return done(null, false, {
            message: "Felhasználónév vagy jelszó nem egyezik!",
          });
        }

        return done(null, foundUser);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.email));

  passport.deserializeUser(async (email, done) => {
    try {
      const user = await findUserByEmail(email); // <- hiányzott az await
      return done(null, user);
    } catch (e) {
      return done(e);
    }
  });
}
