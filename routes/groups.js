import express from "express";
import {} from "../database.js";
import {
  getAllGroups,
  getGroupsOfUser,
  addGroup,
  findUserByEmail,
} from "../helpers.js";

const router = express.Router();

router.get("/all", async (req, res) => {
  if (req.isAuthenticated()) {
    const allGroups = await getAllGroups();
    res.json(allGroups);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.get("/ofUser", async (req, res) => {
  if (req.isAuthenticated()) {
    const { username } = req.query;
    console.log("username az ofUser endpoint-on: ", username);
    const groups = await getGroupsOfUser(username);
    res.json(groups);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.post("/create", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }
  const { name, description } = req.body;
  const user = await findUserByEmail(req.session.passport.user);

  if (!name || !name.trim()) {
    return res.status(400).json({ msg: "A csoport neve kötelező!" });
  }
  try {
    const group = await addGroup(
      name.trim(),
      description?.trim() || "",
      user.id
    );
    res.status(201).json({ msg: "Csoport létrehozva!", group });
  } catch (e) {
    if (e.message.includes("foglal")) {
      res.status(409).json({ msg: e.message });
    } else {
      res.status(500).json({ msg: "Szerverhiba: " + e.message });
    }
  }
});

export default router;
