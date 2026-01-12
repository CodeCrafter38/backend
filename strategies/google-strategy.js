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
        // request object a verify callback-nek
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const primaryEmail =
            profile.emails && profile.emails[0] && profile.emails[0].value;

          if (!primaryEmail) {
            return done(null, false, {
              message: "A Google-fiók nem adott vissza email címet.",
            });
          }

          let user = await findUserByEmail(primaryEmail);

          // role a sessionből (ha nincs, fallback)
          const selectedRole =
            req.session?.googleSignupRole === "TEACHER" ? "TEACHER" : "STUDENT";

          if (req.session) delete req.session.googleSignupRole;

          if (!user) {
            const baseUsername =
              profile.displayName ||
              primaryEmail.split("@")[0] ||
              "google_user";

            let username = baseUsername;
            let suffix = 1;

            while (await findUserByName(username)) {
              username = `${baseUsername}_${suffix++}`;
            }

            await addUser(username, primaryEmail, null, selectedRole);
            user = await findUserByEmail(primaryEmail);

            if (!user) {
              return done(new Error("User létrehozás után sem található!"));
            }
          }

          return done(null, user);
        } catch (err) {
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
