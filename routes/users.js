import express from "express";
import {} from "../database.js";
import { findUserByName } from "../helpers.js";

const router = express.Router();

router.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const username = req.query;
    const user = await findUserByName(username);
    res.json(user);
  } else {
    return res.status(401).send({ msg: "You are not authenticated" });
  }
});

router.post("/", (req, res) => {
  if (req.isAuthenticated()) {
    const { title, content, userId, groupId } = req.body;
    createPost(title, content, userId, groupId);
    res.json({ msg: "Post created in the given group" });
  } else {
    return res.status(401).json({ msg: "You are not authenticated" });
  }
});

export default router;
