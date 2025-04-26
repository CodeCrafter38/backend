import express from "express";
import bcrypt from "bcrypt";
import passport from "passport";
import { findUserByEmail, addUser } from "../users.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { username, email, password, role } = req.body;

  const foundUser = await findUserByEmail(email);
  if (foundUser) {
    return res.status(400).json({ msg: "The given user already exists" });
  }

  const hashed = await bcrypt.hash(password, 10);
  addUser(username, email, hashed, role);
  res.json({ msg: "User created successfully" });
});

router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureMessage: true,
  }),
  async (req, res) => {
    res.redirect("posts");
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

router.get("/me", (req, res) => {
  // console.log("Session:\n", req.session);
  // console.log("Session id:\n", req.session.id);
  // console.log(
  //   "Session store:\n",
  //   req.sessionStore.get(req.session.id, (err, sessionData) => {
  //     if (err) {
  //       console.log(err);
  //       throw err;
  //     }
  //     console.log(sessionData);
  //   })
  // );
  if (req.isAuthenticated()) {
    res.json({ email: req.user.email });
  } else {
    res.status(401).json({ msg: "You are not authenticated" });
  }
});

router.post("/logout", (req, res) => {
  req.logout(() => {
    res.json({ msg: "You are logged out" });
  });
});

export default router;
