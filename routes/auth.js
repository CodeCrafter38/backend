// Auth router: regisztráció, login, logout, /me (aktuális user), és Google azonosítás indítása.
// Itt történik a session létrehozása, majd a későbbi route-ok megnézik, hogy authentikált-e a lekérdező felhasználó.

import express from "express";
import bcrypt from "bcrypt";
import passport from "passport";
import {
  findUserByEmail,
  findUserByName,
  addUser,
  changeUsername,
  changePassword,
} from "../helpers.js";

const router = express.Router();

router.get(
  "/auth/google",
  (req, res, next) => {
    // a szerepkör a query paraméterből jön: ?role=TEACHER vagy STUDENT
    // normalizeRole: csak ezt a két értéket engedjük át, különben STUDENT lesz.
    const role = normalizeRole(req.query.role);

    // A választott role-t elmentjük sessionbe, hogy a Google callbacknél is elérhető legyen.
    // Ez azért kell, mert a Google redirect közben elveszne a query param, ha nem tároljuk el egy olyan helyre, ahonnan itt elérjük.
    req.session.googleSignupRole = role;

    // Kényszerített session mentés átirányítás előtt:
    // ha a store (pl. Redis / MemoryStore) aszinkron, akkor redirect előtt még nem biztos,
    // hogy a session elmentődött. Itt ezt kezeljük.
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  },
  passport.authenticate("google", {
    // email + profile kell a primaryEmail és displayName miatt.
    scope: ["profile", "email"],
  }),
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    // Hibás Google login esetén ide irányít át.
    failureRedirect: "http://localhost:3000/login",
    // failureMessage akkor hasznos, ha van middleware, ami kiolvassa (pl. connect-flash).
    failureMessage: "Google bejelentkezés sikertelen!",
  }),
  async (req, res) => {
    // Siker esetén visszaírányítunk a frontendre.
    // Javítási lehetőség: .env fájlból kiolvasni a frontend URL-t.
    res.redirect("http://localhost:3000/home");
  },
);

router.post("/signup", async (req, res) => {
  // Helyi regisztráció: username -email - password - role.
  // Fontos: a role-t érdemes a backend oldalon is validálni (itt nem történik meg explicit módon).
  const { username, email, password, role } = req.body;

  // Duplikáció ellenőrzés: email vagy username foglalt-e.
  // Megjegyzés: továbbra is szükséges DB oldali UNIQUE megkötés, különben versenyhelyzet bekavarhat.
  const foundUserByEmail = await findUserByEmail(email);
  const foundUserByName = await findUserByName(username);
  if (foundUserByEmail || foundUserByName) {
    return res.status(400).json({ msg: "A megadott felhasználó már létezik!" });
  }

  // bcrypt hash: 10 salt round klasszikus default.
  // Így nem a plain password kerül be a DB-be.
  const hashed = await bcrypt.hash(password, 10);
  const createdUser = await addUser(username, email, hashed, role);
  if (createdUser) {
    res.json({ msg: "Felhasználó létrehozása sikeres!" });
  } else {
    // Itt a helper dobna hibát, ha a createUser null értékkel tér vissza.
    res.json({ msg: "Felhasználó létrehozása sikertelen!" });
  }
});

router.post("/login", (req, res, next) => {
  // Local login: passport.authenticate("local") fut le, ami a local-strategy.js-ben van konfigurálva.
  // Custom callback-et használunk, így mi döntjük el a HTTP státuszt és üzenetet.
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.status(500).json({ msg: "Általános szerver hiba!" });
    }

    if (!user) {
      // 401: hitelesítési hiba
      return res
        .status(401)
        .json({ msg: info?.message ?? "Bejelentkezés sikertelen!" });
    }

    // req.logIn: létrehozza a session-t passport oldalon.
    // Ha ez kimarad, a user ugyan megvan, de nem lesz bejelentkezett állapot.
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ msg: "Szerver hiba (session)!" });
      }
      return res.sendStatus(200);
    });
  })(req, res, next);
});

router.get("/me", async (req, res) => {
  // Debug: session logolás.
  console.log("Session a posts-ban:\n", req.session);
  console.log("Session id a posts-ban:\n", req.session.id);
  req.sessionStore.get(req.session.id, (err, sessionData) => {
    if (err) {
      console.log(err);
      throw err;
    }
    console.log("Session adatok:\n", sessionData);
  });

  req.session.visited = true;

  if (req.isAuthenticated()) {
    // A sessionben a passport a serializeUser() által eltett kulcsot tárolja (itt: email).
    const foundUser = await findUserByEmail(req.session.passport.user);
    const userId = foundUser.id;
    const username = foundUser.username;
    const role = foundUser.role;
    const profilePicture = foundUser.profile_picture;

    // Google user esetén a jelszó null, tehát a Nexus-ban nem állítunk be jelszót (a Google végzi el az azonosítást).
    // Ez a flag frontenden használható a UI döntésekhez.
    const canChangePassword = !!req.user.password;

    const themeMode = foundUser.theme_mode;
    const themePalette = foundUser.theme_palette;

    res.json({
      user: {
        userId,
        username,
        role,
        profilePicture,
        canChangePassword,
        themeMode,
        themePalette,
      },
    });
  } else {
    return res.status(401).json({ message: "Sikertelen azonosítás!" });
  }
});

router.post("/logout", (req, res) => {
  // Passport logout: session megszüntetés.
  // (A pontos viselkedés passport verziótól függ, itt callback-es formát használunk.)
  req.logout((e) => {
    if (e) {
      return res.status(500).json({ message: "Sikertelen kijelentkezés!" });
    }

    res.json({ message: "Kijelentkezés sikeres" });
  });
});

router.post("/change-username", async (req, res) => {
  // Védett endpoint: csak bejelentkezett felhasználót enged át.
  if (!req.isAuthenticated()) {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }

  const { oldUsername, newUsername } = req.body;

  try {
    // Megkeressük az aktuális user-t a session kulcsból (email).
    const user = await findUserByEmail(req.session.passport.user);

    if (!user) {
      return res.status(404).json({ msg: "A felhasználó nem található!" });
    }

    // Védjük, hogy más user nevében ne lehessen módosítani (oldUsername ellenőrzés).
    if (user.username !== oldUsername) {
      return res
        .status(400)
        .json({ msg: "A régi felhasználónév nem egyezik!" });
    }

    // Üres vagy azonos értékek kizárása (trim-mel).
    if (
      oldUsername === newUsername ||
      oldUsername.trim() === newUsername.trim()
    ) {
      return res
        .status(400)
        .json({ msg: "Az új felhasználónév nem egyezhet meg a régivel!" });
    }

    // Foglaltság ellenőrzés (van-e már ilyen user)
    const existingUser = await findUserByName(newUsername.trim());
    if (existingUser) {
      return res
        .status(409)
        .json({ msg: "A megadott felhasználónév foglalt!" });
    }

    if (!newUsername || !newUsername.trim()) {
      return res
        .status(400)
        .json({ msg: "Az új felhasználónév nem lehet üres!" });
    }

    // DB update a helperen keresztül.
    const updated = await changeUsername(user.id, newUsername);
    return res
      .status(200)
      .json({ msg: "Felhasználónév módosítva!", user: updated });
  } catch (e) {
    return res.status(500).json({
      msg:
        "Szerver hiba történt a felhasználónév módosítás során: " + e.message,
    });
  }
});

router.post("/change-password", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }

  const { oldPassword, newPassword } = req.body;
  try {
    const user = await findUserByEmail(req.session.passport.user);
    if (!user) {
      return res.status(404).json({ msg: "A felhasználó nem található!" });
    }

    // Google login esetén nincs password, ezért tiltjuk.
    // Ez fontos szerver oldalon is, mert a frontend tiltása megkerülhető.
    if (!req.user.password) {
      return res.status(403).json({
        msg: "Google-fiókkal bejelentkezett felhasználó nem módosíthat jelszót.",
      });
    }

    // Régi jelszó ellenőrzés (bcrypt compare).
    if (!(await bcrypt.compare(String(oldPassword), String(user.password)))) {
      return res.status(403).json({ msg: "Érvénytelen régi jelszó!" });
    }

    // Új jelszó hash és frissítés.
    const hashed = await bcrypt.hash(newPassword, 10);
    const updated = await changePassword(user.id, hashed);

    return res.status(200).json({ msg: "Jelszó módosítva!", user: updated });
  } catch (e) {
    return res.status(500).json({
      msg: "Szerver hiba történt a jelszó módosítás során: " + e.message,
    });
  }
});

function normalizeRole(raw) {
  // Minimal input-szűrés: csak két szerepkör megengedett.
  // Ez azért fontos, mert a query paraméter user-kontroll alatt áll.
  const r = String(raw ?? "").toUpperCase();
  return r === "TEACHER" || r === "STUDENT" ? r : "STUDENT";
}

export default router;
