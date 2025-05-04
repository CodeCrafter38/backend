import express from "express";
import {} from "../database.js";
import { getGroupsOfUser } from "../helpers.js";

const router = express.Router();

router.get("/ofUser", async (req, res) => {
  if (req.isAuthenticated()) {
    const { username } = req.query;
    console.log("username in ofUser endpoint: ", username);
    const groups = await getGroupsOfUser(username);
    res.json(groups);
  } else {
    return res.status(401).send({ msg: "You are not authenticated" });
  }
});

export default router;
