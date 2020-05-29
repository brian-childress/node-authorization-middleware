const express = require("express");
const jwt = require("jsonwebtoken");
const authorize = require("./auth-stuff");
const config = require("./config");

const app = express();
const port = process.env.PORT || 5000;

app.get("/token", (req, res) => {
  const payload = {
    name: "Jimmy",
    scopes: "customer:read"
  };

  const token = jwt.sign(payload, 'Mysecret');
  res.send(token);
});

app.get("/customer", authorize("customer:read"), (req, res) => {
  res.send("Customer Information");
});

const server = app.listen(5000, () => {
  console.log(`Server is listening on 3000`);
});
