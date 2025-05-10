import express from "express";
import {} from "../database.js";
import { getGroupsOfUser } from "../helpers.js";

const router = express.Router();

router.get("/ofUser", async (req, res) => {
  if (req.isAuthenticated()) {
    const { username } = req.query;
    console.log("username a user endpoint-on: ", username);
    const groups = await getGroupsOfUser(username);
    res.json(groups);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
