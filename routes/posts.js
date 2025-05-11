import express from "express";
import { findUserByName, addPost, getPostsWithComments } from "../helpers.js";

const router = express.Router();

router.get("/", async (req, res) => {
  // console.log("Session in posts:\n", req.session);
  // console.log("Session id in posts:\n", req.session.id);
  if (req.isAuthenticated()) {
    const { username } = req.query;
    const posts = await getPostsWithComments(username);
    res.json(posts);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.post("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const { title, content, userName, isPublic, selectedGroupIds } = req.body;
    const user = await findUserByName(userName);
    const userId = user.id;
    if (userId) {
      await addPost(title, content, userId, isPublic, selectedGroupIds);
      res.json({ msg: "Poszt létrehozás sikeres!" });
    } else {
      return res
        .status(400)
        .json({ msg: "A megadott felhasználó nem létezik!" });
    }
  } else {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
