import express from "express";
import path from "path";
import fs from "fs";
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
const __dirname = path.resolve();
const profilePicturesPath = path.join(__dirname, "profilePictures");

router.get(
  "/auth/google",
  (req, res, next) => {
    const role = normalizeRole(req.query.role);

    // elmentjük a választást a Google callback folyamatig
    req.session.googleSignupRole = role;

    // session mentése átirányítás előtt
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  },
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:3000/login",
    failureMessage: "Google bejelentkezés sikertelen!",
  }),
  async (req, res) => {
    res.redirect("http://localhost:3000/home");
  }
);

router.post("/signup", async (req, res) => {
  const { username, email, password, role } = req.body;

  const foundUserByEmail = await findUserByEmail(email);
  const foundUserByName = await findUserByName(username);
  if (foundUserByEmail || foundUserByName) {
    return res.status(400).json({ msg: "A megadott felhasználó már létezik!" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const createdUser = await addUser(username, email, hashed, role);
  if (createdUser) {
    res.json({ msg: "Felhasználó létrehozása sikeres!" });
  } else {
    res.json({ msg: "Felhasználó létrehozása sikertelen!" });
  }
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.status(500).json({ msg: "Általános szerver hiba!" });
    }

    if (!user) {
      return res
        .status(401)
        .json({ msg: info?.message ?? "Bejelentkezés sikertelen!" });
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ msg: "Szerver hiba (session)!" });
      }
      return res.sendStatus(200);
    });
  })(req, res, next);
});

router.get("/me", async (req, res) => {
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
    const foundUser = await findUserByEmail(req.session.passport.user);
    const userId = foundUser.id;
    const username = foundUser.username;
    const role = foundUser.role;
    const profilePicture = foundUser.profile_picture;

    const canChangePassword = !!req.user.password;

    res.json({
      user: { userId, username, role, profilePicture, canChangePassword },
    });
  } else {
    return res.status(401).json({ message: "Sikertelen azonosítás!" });
  }
});

router.post("/logout", (req, res) => {
  req.logout((e) => {
    if (e) {
      return res.status(500).json({ message: "Sikertelen kijelentkezés!" });
    }

    res.json({ message: "Kijelentkezés sikeres" });
  });
});

router.post("/change-username", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }

  const { oldUsername, newUsername } = req.body;

  try {
    // megkeressük a bejelentkezett felhasználót
    const user = await findUserByEmail(req.session.passport.user);

    if (!user) {
      return res.status(404).json({ msg: "A felhasználó nem található!" });
    }

    if (user.username !== oldUsername) {
      return res
        .status(400)
        .json({ msg: "A régi felhasználónév nem egyezik!" });
    }

    if (
      oldUsername === newUsername ||
      oldUsername.trim() === newUsername.trim()
    ) {
      return res
        .status(400)
        .json({ msg: "Az új felhasználónév nem egyezhet meg a régivel!" });
    }

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
    // megkeressük a bejelentkezett felhasználót
    const user = await findUserByName(req.session.passport.user);
    if (!user) {
      return res.status(404).json({ msg: "A felhasználó nem található!" });
    }

    // Google-fiókkal bejelentkezett felhasználó nem módosíthat jelszót (frontenden is védve van, de backenden is szükséges)
    if (!req.user.password) {
      return res.status(403).json({
        msg: "Google-fiókkal bejelentkezett felhasználó nem módosíthat jelszót.",
      });
    }

    if (!(await bcrypt.compare(String(oldPassword), String(user.password)))) {
      return res.status(403).json({ msg: "Érvénytelen régi jelszó!" });
    }

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
  const r = String(raw ?? "").toUpperCase();
  return r === "TEACHER" || r === "STUDENT" ? r : "STUDENT";
}

export default router;
