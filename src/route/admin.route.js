const express = require("express");
const router = express.Router();
const adminController = require("../controller/admin.controller");


// Route for updating new video
router.get("/updateNewVideo", adminController.updateNewVideo);
module.exports = router;