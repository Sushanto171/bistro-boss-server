require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PROT || 5000;
const app = express();

// middleware
app.use(express.json());
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

    app.get("/carts/:email", async (req, res) => {
      try {
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
