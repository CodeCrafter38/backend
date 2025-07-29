import express from "express";
import {} from "../database.js";
import { findUserByName, getUsersOfGroup } from "../helpers.js";

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

router.get("/ofGroup", async (req, res) => {
  if (req.isAuthenticated()) {
    const { groupId } = req.query;
    console.log("groupId az ofGroup endpoint-on: ", groupId);
    const users = await getUsersOfGroup(groupId);
    res.json(users);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
