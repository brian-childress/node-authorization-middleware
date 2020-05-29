const express = require("express");

const app = express();

app.get("/customer", (req, res) => {
  res.send("Customer Information");
});

app.listen(5000, () => {
  console.log(`Server is listening...`);
});
