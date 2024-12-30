const express = require("express");
const cors = require("cors");
const port = process.env.PROT || 5000;
const app = express();

// middleware
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Bistro boss restaurant server running...");
});

app.listen(port, () => {
  console.log(`server run on port:${port}`);
});
