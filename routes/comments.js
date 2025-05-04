import express from "express";
import {} from "../database.js";
import {} from "../helpers.js";

const router = express.Router();

router.get("/", async (req, res) => {
  // console.log("Session in posts:\n", req.session);
  // console.log("Session id in posts:\n", req.session.id);
  if (req.isAuthenticated()) {
    const posts = await getPosts();
    res.json(posts);
  } else {
    return res.status(401).send({ msg: "You are not authenticated" });
  }
});

router.post("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const { title, content, userName, isPublic, selectedGroups } = req.body;
    const user = await findUserByName(userName);
    const userId = user.id;
    if (userId) {
      await addPost(title, content, userId, isPublic, selectedGroups);
      res.json({ msg: "Post created in the given groups" });
    } else {
      return res.status(400).json({ msg: "Given user does not exist" });
    }
  } else {
    return res.status(401).json({ msg: "You are not authenticated" });
  }
});

export default router;
