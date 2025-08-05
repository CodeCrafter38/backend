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
    res.json({ msg: "Felhasználó létrehozása sikeres" });
  } else {
    res.json({ msg: "Felhasználó létrehozása sikertelen!" });
  }
});

router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureMessage: "Felhasználónév vagy jelszó nem egyezik!",
  }),
  async (req, res) => {
    res.sendStatus(200);
  }
);

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
    const username = foundUser.username;
    const role = foundUser.role;
    res.json({ user: { username, role } });
    //res.json({ user: req.session.passport.user });
    // res.status(200).send({ cookie: req.session.cookie });
  } else {
    res.status(401).send("Sikertelen azonosítás!");
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

export default router;
