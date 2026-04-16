// Passport Local Strategy (email + jelszó) konfiguráció.
// Cél: klasszikus lokális bejelentkezés (nem OAuth), ahol a felhasználót kikeressük az adatbázisból,
// majd bcrypt-tel ellenőrizzük a jelszót.
// Ez a szint csak az autentikációt végzi el (ki a user). A session-t és a védelmet (req.isAuthenticated)
// együtt biztosítja a passport és az express-session.

import { Strategy } from "passport-local";
import bcrypt from "bcrypt";
import { findUserByEmail } from "../helpers.js";

export default function initialize(passport) {
  // 1) Strategy regisztrálása: usernameField átállítása email-re,
  // mert a passport-local alapból username-et várna.
  passport.use(
    new Strategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        // 2) Felhasználó keresése email alapján.
        const foundUser = await findUserByEmail(email);

        // 3) Ha nincs user, ugyanazt az üzenetet adjuk vissza, mint rossz jelszó esetén.
        // Tehát a hibaüzenetben nem áruljuk el, hogy a felhasználónév létezik-e (user enumeration védelem).
        if (!foundUser) {
          return done(null, false, {
            message: "Felhasználónév vagy jelszó nem egyezik!",
          });
        }

        // 4) Jelszó ellenőrzés bcrypt compare-ral.
        // String() cast: akkor hasznos, ha a beérkező payload vagy DB mező nem garantáltan string.
        // (pl. valahol Buffer/number/nullable lett).
        // Biztonsági szempontból a bcrypt compare a standard megoldás.
        const ok = await bcrypt.compare(
          String(password),
          String(foundUser.password),
        );
        if (!ok) {
          return done(null, false, {
            message: "Felhasználónév vagy jelszó nem egyezik!",
          });
        }

        // 5) Sikeres ág: a user bekerül a req.user-be, lefut a serializeUser.
        return done(null, foundUser);
      } catch (err) {
        // 6) Hiba: done(err) -> passport hibakezelés, általában 500-as válasz vagy fallback.
        return done(err);
      }
    }),
  );

  // serializeUser: itt az a kérdés, hogy mit tegyünk a session-be
  // Itt az email kerül be azonosítóként. Előnye: emberi szemmel olvasható és egyedi (az adatbázisban garantált).
  // Hátránya: ha később engedünk email változtatást, a régi session-ök kihasználatlanul maradhatnak.
  passport.serializeUser((user, done) => done(null, user.email));

  // deserializeUser: a session-ben tárolt kulcsból újra beolvassuk a user-t minden kéréskor.
  // Ez biztosítja, hogy a req.user friss adatot kapjon (pl.ha lenne role változás).
  passport.deserializeUser(async (email, done) => {
    try {
      // kell az await, különben Promise kerülne a user helyére,
      // ami később random hibákat, undefined mezőket okoz.
      const user = await findUserByEmail(email);
      return done(null, user);
    } catch (e) {
      return done(e);
    }
  });
}
