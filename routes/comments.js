import express from "express";
import { createComment, getComments } from "../database.js";
import { findUserByEmail } from "../helpers.js";
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

router.delete("/:id", async (req, res) => {
  if (req.isAuthenticated()) {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "Érvénytelen komment id!" });
    }

    const user = await findUserByEmail(req.session.passport.user);
    if (!user) {
      return res.status(401).json({ msg: "Sikertelen azonosítás!" });
    }

    const comment = await queries.getCommentById(userId);
    if (!comment) {
      return res.status(404).json({ error: "Komment nem található" });
    }

    const commentOwnerId = Number(comment.user_id);

    if (user.role !== "ADMIN" && commentOwnerId !== user.id) {
      return res
        .status(403)
        .json({ error: "Nincs jogosultságod a komment törlésére!" });
    }

    const createdAtRaw = comment.created_at ?? comment.createdAt;
    const createdAt = new Date(createdAtRaw);

    if (Number.isNaN(createdAt.getTime())) {
      return res
        .status(500)
        .json({ error: "Hibás komment dátum az adatbázisban!" });
    }

    const ageMs = Date.now() - createdAt.getTime();
    const now = new Date();
    if (user.role !== "ADMIN" && ageMs > 60_000) {
      return res
        .status(403)
        .json({ error: "1 perc után már nem törölhető a beküldött komment!" });
    }

    const ok = await queries.deleteComment(userId);
    if (ok) {
      res.status(204).send();
    } else {
      res.status(500).send("Adatbázis hiba történt a komment törlésekor!");
    }
  } else {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
