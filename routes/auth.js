const express = require("express");
const router = express.Router();
const pool = require("../db.js");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwtGenerator = require("../utils/jwtGenerator");
const validEmail = require("../middleware/validEmail.js");
const verifyToken = require("../middleware/verifyToken.js");
const cloudinary = require("../utils/cloudinary");
const upload = require("../utils/multer");

// register route
router.post("/register", validEmail, async (req, res) => {
  const file = req.files.image;
  try {
    // console.log(file);

    // console.log(req.body, "here");

    // Create new user
    let data = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      age: req.body.age,
      degree: req.body.degree,
      experience: req.body.experience,
      location: req.body.location,
      image_url: req.body.image,
      cloudinary_id: req.body.image,
    };
    // req.on('data', (data, any) => {
    //   console.log(data.toString());
    //   });

    //   req.on('end', () => {
    //   res.json({
    //   fileUpload: 'successful'
    //   });
    //   });

    // Save user
    const user = await pool.query("SELECT * FROM job_seeker WHERE email = $1", [
      data.email,
    ]);

    if (user.rows.length !== 0) {
      return res.status(401).json({
        error:
          "A user with the email provided exists in the database... Kindly login!",
      });
    }

    await bcrypt.hash(data.password, saltRounds, (error, hash) => {
      if (error) {
        res.status(500).json(error);
      }

      // Upload image to cloudinary
      cloudinary.uploader
        .upload(file.tempFilePath)
        .then((image) => {
          const insertQuery =
            "INSERT INTO job_seeker (username, email, password, age, degree, experience, location,image_url, cloudinary_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *";
          const values = [
            data.username,
            data.email,
            hash,
            data.age,
            data.degree,
            data.experience,
            data.location,
            image.secure_url,
            image.public_id,
          ];

          // execute query
          pool
            .query(insertQuery, values)
            .then((result) => {
              newUser = result.rows[0];

              const token = jwtGenerator(newUser.user_id);

              // send success response
              res.status(201).send({
                status: "success",
                data: {
                  newUser,
                  token,
                },
              });
            })
            .catch((e) => {
              res.status(500).send({
                message: "failure 1",
                e,
              });
            });
        })
        .catch((error) => {
          res.status(500).send({
            message: "failure 2",
            error,
          });
        });
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
  pool.end;
});

// login route
router.post("/login", validEmail, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await pool.query("SELECT * FROM job_seeker WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      res
        .status(401)
        .json({ error: "No user with that email found...Kindly signup!" });
    }

    bcrypt.compare(password, user.rows[0].password, (error, match) => {
      if (error) {
        res.status(500).json(error);
      }
      if (match) {
        res.status(200).json({
          message: "Success!",
          token: jwtGenerator(user.rows[0].user_id),
        });
      } else {
        res.status(400).json({
          error: "Passwords do not match... Kindly enter a valid password!",
        });
      }
    });
  } catch (err) {
    // console.error(err.message);
    res.status(500).json(err.message);
  }
});

module.exports = router;