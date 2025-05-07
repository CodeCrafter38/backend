import express from "express";
import { createComment, getComments } from "../database.js";
import { findUserByName } from "../helpers.js";

const router = express.Router();

router.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const comments = await getComments();
    res.json(comments);
  } else {
    return res.status(401).send({ msg: "You are not authenticated" });
  }
});

router.post("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const { postId, userName, content } = req.body;
    const user = await findUserByName(userName);
    const userId = user.id;
    if (userId) {
      const comment = await createComment(content, postId, userId);
      res.json({ msg: "Comment added to the given post" }, comment);
    } else {
      return res.status(400).json({ msg: "Given user does not exist" });
    }
  } else {
    return res.status(401).json({ msg: "You are not authenticated" });
  }
});

export default router;
