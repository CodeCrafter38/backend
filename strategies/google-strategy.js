// Passport Google OAuth 2.0 strategy.
// Cél: Google bejelentkezés, majd:
// - ha az email már létezik: beléptetés
// - ha nem létezik: automatikus user létrehozás és beléptetés
//
// Fontos rész: passReqToCallback = true, így a verify callback megkapja a request-et,
// tehát el tudjuk érni a session-ben tárolt, kiválasztott szerepkört.

import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import { findUserByEmail, findUserByName, addUser } from "../helpers.js";

dotenv.config();

export default function initializeGoogleStrategy(passport) {
  console.log("Google strategy inicializálása...");

  passport.use(
    new GoogleStrategy(
      {
        // A kliens adatok a .env-ből jönnek.
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        // request object átadása a verify callback-nek
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          // Google profilból az elsődleges email kinyerése.
          // Nem minden fiók ad vissza emailt, ezért külön validálunk.
          const primaryEmail =
            profile.emails && profile.emails[0] && profile.emails[0].value;

          if (!primaryEmail) {
            // Itt false user: autentikáció sikertelen, egyértelmű üzenettel.
            return done(null, false, {
              message: "A Google-fiók nem adott vissza email címet.",
            });
          }

          // Megnézzük, létezik-e már user ezzel az emaillel.
          let user = await findUserByEmail(primaryEmail);

          // Role kiválasztás sessionből:
          // - frontend a /auth/google?role=... paraméterrel küldi a kérést
          // - auth.js middleware elmenti ezt a req.session.googleSignupRole-ba
          // - itt kiolvassuk, majd törljük, hogy ne ragadjon bent a session-ben
          const selectedRole =
            req.session?.googleSignupRole === "TEACHER" ? "TEACHER" : "STUDENT";

          if (req.session) delete req.session.googleSignupRole;

          if (!user) {
            // Ha nincs user, automatikus regisztráció:
            // username alapnak: displayName, vagy email előtag, vagy fallback.
            const baseUsername =
              profile.displayName ||
              primaryEmail.split("@")[0] ||
              "google_user";

            // Ütközés-kezelés: ha a név foglalt, utótagot (suffix) növelünk.
            // DB oldalon is kell lennie UNIQUE constraint a username-re,
            // különben konkurens hozzáférésnél egyszerre két kérés ugyanazt a nevet adhatja.
            let username = baseUsername;
            let suffix = 1;

            while (await findUserByName(username)) {
              username = `${baseUsername}_${suffix++}`;
            }

            // Google user esetén a password = null (nincs helyi jelszó).
            // A role a sessionből jön, ezért tudunk tanár/diák különbséget kezelni OAuth login során is.
            await addUser(username, primaryEmail, null, selectedRole);

            // A biztonság kedvéért újra lekérjük az adatbázisból, hogy biztosan meglegyen az id/role stb.
            user = await findUserByEmail(primaryEmail);

            if (!user) {
              // Ha létrehozás után sem jön vissza, az adatbázis oldalon van gond.
              return done(new Error("User létrehozás után sem található!"));
            }
          }

          // Siker: req.user és session azonosító beállítása
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // Ugyanaz a minta, mint local esetben: a sessionbe email megy.
  passport.serializeUser((user, done) => {
    console.log("serializeUser -> sessionbe kerül:", user.email);
    done(null, user.email);
  });

  passport.deserializeUser(async (email, done) => {
    try {
      console.log("deserializeUser -> email:", email);
      const user = await findUserByEmail(email);

      // Ha nincs user, az lehet törölt fiók vagy inkonzisztens session.
      // Ilyenkor done(null,false) -> a passport úgy kezeli, mintha nem lenne bejelentkezve.
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
