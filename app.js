const express = require("express");
const jwt = require("jsonwebtoken");
const authorize = require("./auth-stuff");

const app = express();

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

app.listen(5000, () => {
  console.log(`Server is listening on 3000`);
});
