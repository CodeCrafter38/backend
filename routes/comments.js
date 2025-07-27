import express from "express";
import { createComment, getComments } from "../database.js";
import { findUserByName } from "../helpers.js";
import * as queries from "../database.js";

const router = express.Router();

router.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const comments = await getComments();
    res.json(comments);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.post("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const { postId, userName, content } = req.body;
    const user = await findUserByName(userName);
    const userId = user.id;
    if (userId) {
      const comment = await createComment(content, postId, userId);
      res.json({ msg: "Komment hozzáadva a meagdott poszthoz!" }, comment);
    } else {
      return res
        .status(400)
        .json({ msg: "A megadott felhasználó nem létezik!" });
    }
  } else {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }
});

router.delete("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const { id } = req.query;
    const posts = await queries.deleteComment(id);
    if (posts) {
      res.status(204).send();
    } else {
      res.status(500).send("Adatbázis hiba történt!");
    }
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
