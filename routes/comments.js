import express from "express";
import { createComment, getComments } from "../database.js";
import { findUserByName, findUserByEmail } from "../helpers.js";
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
    // megkeressük a bejelentkezett felhasználót
    const user = await findUserByEmail(req.session.passport.user);
    if (!user) {
      return res.status(404).json({ msg: "A felhasználó nem található!" });
    }
    const userId = user.id;
    const { postId, content } = req.body;
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
    const user = await findUserByEmail(req.session.passport.user);

    const comment = await queries.getCommentById(id);
    if (!comment) {
      return res.status(404).json({ error: "Komment nem található" });
    }

    const createdAt = new Date(comment.createdAt);
    const now = new Date();
    if (now - createdAt > 60 * 1000 && user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "1 perc után már nem törölhető a beküldött komment!" });
    }

    const posts = await queries.deleteComment(id);
    if (posts) {
      res.status(204).send();
    } else {
      res.status(500).send("Adatbázis hiba történt a komment törlésekor!");
    }
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
