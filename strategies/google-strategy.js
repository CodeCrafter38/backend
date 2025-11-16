import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { findUserByEmail, findUserByName, addUser } from "../helpers.js";

dotenv.config();

export default function initializeGoogleStrategy(passport) {
  console.log("Google strategy inicializálása...");

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Email megszerzése a Google profilból
          const primaryEmail =
            profile.emails && profile.emails[0] && profile.emails[0].value;

          console.log("Google profil:", {
            id: profile.id,
            displayName: profile.displayName,
            emails: profile.emails,
          });

          if (!primaryEmail) {
            console.error("Nincs email a Google profilban.");
            return done(null, false, {
              message: "A Google-fiók nem adott vissza email címet.",
            });
          }

          let user = await findUserByEmail(primaryEmail);
          console.log("Meglévő user (email alapján):", user);

          if (!user) {
            console.log(
              "Nincs felhasználó ilyen email címmel, létrehozunk egyet."
            );

            const baseUsername =
              profile.displayName ||
              primaryEmail.split("@")[0] ||
              "google_user";

            let username = baseUsername;
            let suffix = 1;

            // Ha a username foglalt, kap számozást a végére
            while (await findUserByName(username)) {
              username = `${baseUsername}_${suffix++}`;
            }

            // Random jelszó (csak hogy megfeleljen a séma követeményeknek)
            const randomPassword = (Math.random() + 1)
              .toString(36)
              .substring(2);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            // Egyelőre default tanuló felhasználó jön létre
            // TODO: Később lehetőséget adni a szerepkör kiválasztására
            const defaultRole = "STUDENT";

            console.log("User létrehozása:", {
              username,
              primaryEmail,
              defaultRole,
            });

            const created = await addUser(
              username,
              primaryEmail,
              hashedPassword,
              defaultRole
            );

            console.log("addUser visszatérési értéke:", created);

            // Ha az addUser nem user-objektumot ad vissza, újra lekérjük
            user = await findUserByEmail(primaryEmail);
            console.log("Frissen létrehozott user:", user);

            if (!user) {
              return done(
                new Error(
                  "Felhasználó létrehozása után nem található az adatbázisban!"
                )
              );
            }
          }

          console.log("Google bejelentkezés sikeres, felhasználó:", {
            id: user.id,
            username: user.username,
            email: user.email,
          });

          return done(null, user);
        } catch (err) {
          console.error("Google bejelenetkezés hiba:", err);
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    console.log("serializeUser -> sessionbe kerül:", user.email);
    done(null, user.email);
  });

  passport.deserializeUser(async (email, done) => {
    try {
      console.log("deserializeUser -> email:", email);
      const user = await findUserByEmail(email);
      if (!user) {
        console.error("deserializeUser: nem talált user-t az emailhez.");
        return done(null, false);
      }
      return done(null, user);
    } catch (err) {
      console.error("deserializeUser hiba:", err);
      return done(err);
    }
  });
}
