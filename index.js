const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const morgan = require("morgan");
const stripe = require("stripe")(`${process.env.STRIPE_SECRET_KEY}`);
const nodemailer = require("nodemailer");

app.use(express.static("public"));
app.use(express.json());

const calculateOrderAmount = (items) => {
  // Replace this constant with a calculation of the order's amount
  // Calculate the order total on the server to prevent
  // people from directly manipulating the amount on the client
  return 1400;
};

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r3tx4xp.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJWT = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "Unauthorized Access" });
  } else {
    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
      if (err) {
        return res
          .status(403)
          .send({ error: true, message: "Token is not valid" });
      } else {
        req.decoded = decoded;
        next();
      }
    });
  }
};

// use Nodemailer

const useNodeMailer = (data, emailAddress) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASS,
    },
  });
  const mailOptions = {
    from: process.env.NODEMAILER_EMAIL,
    to: emailAddress,
    subject: data.subject,
    html: `<p>${data.message}</p>`,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
      // do something useful
    }
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("aircncDb").collection("users");
    const roomsCollection = client.db("aircncDb").collection("rooms");
    const bookingsCollection = client.db("aircncDb").collection("bookings");

    // create jsonwebtoken

    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Save user email and role
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };

      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // check host
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    //updateUserToHost

    // app.patch('/users/:email', (req,res)=>{
    //   const email = req.params.email;
    //   const body = req.body
    //   const filter = { email: email };
    //   const updateDoc = {
    //     $set: body,
    //   };

    //   const result = usersCollection.updateOne(filter,updateDoc)
    //   res.send(result)
    // })

    //save a room in database
    app.post("/addRooms", async (req, res) => {
      const room = req.body;
      const result = await roomsCollection.insertOne(room);
      res.send(result);
    });

    // get all rooms
    app.get("/rooms", async (req, res) => {
      const result = await roomsCollection.find().toArray();
      res.send(result);
    });

    //getSingleRoom

    app.get("/rooms/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    });

    //checkMyListing which rooms was I am added
    app.get("/getMyAddedRooms/:email", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const email = req.params.email;
      if (email !== decoded?.email) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      const filter = { "host.email": email };
      const result = await roomsCollection.find(filter).toArray();
      res.send(result);
    });
    //myListing my rooms delete singleRoom
    app.delete("/deleteSingleRoom/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const result = await roomsCollection.deleteOne(filter);
      res.send(result);
    });
    // add booking in database

    app.post("/bookings", async (req, res) => {
      const item = req.body;
      const result = await bookingsCollection.insertOne(item);
      console.log(result);
      if (result.insertedId) {
        useNodeMailer(
          {
            subject: "Booking Successful!",
            message: `Booking Id: ${result?.insertedId}, TransactionId: ${item.transactionId}`,
          },
          item?.guest?.email
        );
        // Send confirmation email to host
        useNodeMailer(
          {
            subject: "Your room got booked!",
            message: `Booking Id: ${result?.insertedId}, TransactionId: ${item.transactionId}. Check dashboard for more info`,
          },
          item?.host
        );
      }
      res.send(result);
    });

    //find the bookings details
    app.get("/bookings", async (req, res) => {
      const result = await bookingsCollection.find().toArray();
      res.send(result);
    });

    // find the my booking with email
    app.get("/myBookings", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { "guest.email": email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/bookings/host", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { host: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // delete the my booking list of my single booked room

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });
    //make the rooms booked true

    app.patch("/booked/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const data = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: data,
      };

      const result = await roomsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // create client secret
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const price = req.body.price;
      console.log(price);
      if (price) {
        const amount = parseFloat(price) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      }
    });

    // update Room data

    app.put("/updateRoom/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      console.log(id, body);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: body,
      };
      const result = await roomsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // app.post("/users/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const query = { email: email };
    //   const existingUser = await usersCollection.findOne(query);
    //   if (existingUser) {
    //     res.send([]);
    //   } else {
    //     const user = req.body;
    //     const result = await usersCollection.insertOne(user);
    //     res.send(result);
    //   }
    // });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("AirCNC Server is running..");
});

app.listen(port, () => {
  console.log(`AirCNC is running on port ${port}`);
});
