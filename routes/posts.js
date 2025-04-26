import express from "express";
import { getPosts } from "../database.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const lofasz = req;
  if (!req.isAuthenticated?.()) {
    return res.status(401).json({ msg: "You are not authenticated" });
  }
  const posts = await getPosts();
  res.json(posts);
});

router.post("/", (req, res) => {
  if (!req.isAuthenticated?.()) {
    return res.status(401).json({ msg: "You are not authenticated" });
  }

  const { title, content, userId, groupId } = req.body;
  createPost(title, content, userId, groupId);
  res.json({ msg: "Post created in the given group" });
});

export default router;
