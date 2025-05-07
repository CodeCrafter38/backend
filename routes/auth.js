import express from "express";
import bcrypt from "bcrypt";
import passport from "passport";
import { findUserByEmail, addUser } from "../helpers.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { username, email, password, role } = req.body;

  const foundUser = await findUserByEmail(email);
  if (foundUser) {
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
    failureMessage: true,
  }),
  async (req, res) => {
    //res.redirect("posts");
    res.sendStatus(200);
  }
);

router.post("/change-password", async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = findUserByEmail(req.user?.email);

  if (
    !user ||
    !(await bcrypt.compare(String(oldPassword), String(user.password)))
  ) {
    return res.status(403).json({ msg: "Invalid old password" });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  res.json({ msg: "Password updated" });
});

router.get("/me", async (req, res) => {
  console.log("Session in posts:\n", req.session);
  console.log("Session id in posts:\n", req.session.id);
  req.sessionStore.get(req.session.id, (err, sessionData) => {
    if (err) {
      console.log(err);
      throw err;
    }
    console.log("Session data:\n", sessionData);
  });
  req.session.visited = true;
  if (req.isAuthenticated()) {
    const foundUser = await findUserByEmail(req.session.passport.user);
    const username = foundUser.username;
    res.json({ user: username });
    //res.json({ user: req.session.passport.user });
    // res.status(200).send({ cookie: req.session.cookie });
  } else {
    res.status(401).send("You are not authenticated");
  }
});

// router.get("/status", (req, res) => {
//   console.log("req.user in status endpoint: ", req.user);
//   return req.user ? res.send(req.user) : res.sendStatus(401);
// });

router.post("/logout", (req, res) => {
  // req.logout(() => {
  //   res.json({ msg: "You are logged out" });
  // });
  req.logout((e) => {
    if (e) {
      return res.status(500).json({ message: "Sikertelen kijelentkezés!" });
    }

    res.json({ message: "Logged out" });
  });
});

export default router;
