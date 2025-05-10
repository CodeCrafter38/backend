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
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
