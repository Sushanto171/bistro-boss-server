require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PROT || 5000;
const app = express();

// middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors());

const uri = process.env.DB_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // db collection
    const menuCollection = client.db("bistro-boss").collection("menu");
    const reviewsCollection = client.db("bistro-boss").collection("reviews");
    const cartsCollection = client.db("bistro-boss").collection("carts");
    const usersCollection = client.db("bistro-boss").collection("users");

    // generate token
    app.post("/jwt", async (req, res) => {
      const key = process.env.JWT_ACCESS_SECRET;
      const user = req.body;
      const token = jwt.sign(user, key, { expiresIn: "1hr" });
      res.status(200).json({
        message: "token created success",
        data: token,
      });
    });

    // clear token
    app.get("/log-out", async (req, res) => {});

    // verifyToken
    const verifyToken = async (req, res, next) => {
      try {
        const authHeader = req.headers["authorization"];
        const [schema, token] = authHeader.split(" ");
        if (schema !== "Bearer" || !token) {
          return res
            .status(403)
            .json({ message: "Forbidden unauthorized access" });
        }
        jwt.verify(token, process.env.JWT_ACCESS_SECRET, (error, decoded) => {
          if (error) {
            return res
              .status(403)
              .json({ message: "Forbidden unauthorized access" });
          }
          req.user = decoded.email;
          next();
        });
      } catch (error) {
        console.log(error);
      }
    };

    // users related apis
    app.patch("/users/:email", async (req, res) => {
      try {
        const userData = req.body;
        const email = req.params.email;
        const isExist = await usersCollection.findOne({ email });
        if (isExist) {
          res
            .status(200)
            .json({ message: "User already exist", data: isExist._id });
          return;
        }
        const result = await usersCollection.insertOne(userData);
        res.status(201).json({
          success: true,
          message: "Successfully user created",
          data: result,
        });
      } catch (error) {
        console.log(error);
      }
    });

    // cats related apis
    app.post("/carts", async (req, res) => {
      try {
        const cartData = req.body;
        const result = await cartsCollection.insertOne(cartData);
        res.status(201).json({
          success: true,
          message: "Item successfully added to cart",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Sever error. Please try again later." });
      }
    });

    app.get("/carts/:email", verifyToken, async (req, res) => {
      try {
        const user = req.user;
        console.log(user);
        const email = req.params.email;
        const query = { email };
        const result = await cartsCollection.find(query).toArray();
        res.status(200).json({
          success: true,
          message: "Carts list fetching success.",
          data: result,
        });
      } catch (error) {
        res.status(500).send({ message: "Server error. Please try again." });
      }
    });

    // menu related apis
    app.get("/menu", async (req, res) => {
      try {
        const result = await menuCollection.find({}).toArray();
        res.status(200).json({
          success: true,
          message: "All menu fetching success",
          data: result,
        });
      } catch (error) {
        res.status(500).send({ message: "server error" });
      }

      // reviews related api
      app.get("/reviews", async (req, res) => {
        try {
          const result = await reviewsCollection.find({}).toArray();
          res.status(200).json({
            success: true,
            message: "All reviews fetching success",
            data: result,
          });
        } catch (error) {
          console.log(error);
          res.status(500).send({ message: "sever error" });
        }
      });
    });
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Bistro boss restaurant server running...");
});

app.listen(port, () => {
  console.log(`server run on port:${port}`);
});
