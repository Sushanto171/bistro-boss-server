require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { default: Stripe } = require("stripe");
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
    const paymentCollection = client.db("bistro-boss").collection("payments");

    // create intent
    app.post("/create-confirm-intent", async (req, res) => {
      try {
        const { price } = req.body;
        const amount = parseInt(price * 100);

        const intent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.json({ clientSecret: intent.client_secret });
      } catch (error) {
        res.json({ error });
      }
    });

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
        const authHeader = req?.headers["authorization"];
        if (!authHeader)
          return res
            .status(403)
            .json({ message: "Forbidden unauthorized access" });
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

    // admin middleware
    const verifyAdmin = async (req, res, next) => {
      try {
        const user = req.user;
        const query = { email: user };
        const result = await usersCollection.findOne(query);
        const isAdmin = result?.role === "admin";
        if (!isAdmin)
          return res
            .status(403)
            .json({ message: "Forbidden unauthorized access" });

        next();
      } catch (error) {
        console.log(error);
      }
    };
    // check user whether is admin
    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = req.user;
        if (email !== user) {
          return res
            .status(403)
            .json({ message: "Forbidden unauthorized  access" });
        }
        const result = await usersCollection.findOne({ email });
        const role = result?.role === "admin";

        res.status(200).json({ success: true, data: role });
      } catch (error) {
        console.log(error);
      }
    });

    // admin route
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        result = await usersCollection.find({}).toArray();
        res.status(200).json({
          success: true,
          message: "successfully fetched all users data",
          data: result,
        });
      } catch (error) {
        console.log(error);
      }
    });

    // update user role
    app.patch(
      "/user/update/role/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const updatedDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            updatedDoc
          );

          res.status(200).json({
            success: "User role updated",
            data: result,
          });
        } catch (error) {
          console.log(error);
        }
      }
    );

    // delete user
    app.delete(
      "/user/delete/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const result = await usersCollection.deleteOne({
            _id: new ObjectId(id),
          });
          res.status(200).json({
            success: true,
            message: "User successfully deleted",
            data: result,
          });
        } catch (error) {
          console.log(error);
        }
      }
    );

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
        const email = req.params.email;
        const user = req.user;
        if (email !== user) {
          return res.status(403).json({
            message: "Forbidden: unauthorized access.",
            success: false,
          });
        }
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

    // remove menu form cart collection
    app.delete("/cart/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await cartsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.status(200).json({
          success: true,
          message: "Successfully menu deleted form cart",
          data: result,
        });
      } catch (error) {
        res.status(500).send({ message: "internal server error" });
      }
    });

    app.post("/payment", async (req, res) => {
      try {
        const payment = req.body;
        const paymentResult = await paymentCollection.insertOne(payment);

        // carefully delete card collection
        const query = {
          _id: { $in: payment.cartsId.map((id) => new ObjectId(id)) },
        };
        const result = await cartsCollection.deleteMany(query);

        res.status(200).json({
          data: paymentResult,
        });
      } catch (error) {
        res.status(500).send({ message: "internal server error" });
      }
    });

    // get payment by email
    app.get("/payment/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await paymentCollection.find({ email }).toArray();
        res.status(200).json({ message: "fetching success", data: result });
      } catch (error) {
        res.status(500).send({ message: "internal server error" });
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

    // menu delete by id
    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await menuCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.status(200).json({
          success: true,
          message: "Menu deleted success",
          data: result,
        });
      } catch (error) {
        res.status(500).send({ message: "internal server error" });
      }
    });

    // menu data update by id
    app.patch("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const menuData = req.body;
        const updateDoc = { $set: { menuData } };

        const result = await menuCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );
        res.status(200).json({
          success: true,
          message: "Menu updated",
          data: result,
        });
      } catch (error) {
        res.status(500).send({ message: " internal server error" });
      }
    });

    // add item
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const menuData = req.body;
        const result = await menuCollection.insertOne(menuData);
        res.status(201).json({
          success: true,
          message: "Successfully added item",
          data: result,
        });
      } catch (error) {
        console.log(error);
      }
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
