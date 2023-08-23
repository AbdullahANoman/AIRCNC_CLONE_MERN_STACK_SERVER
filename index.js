const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r3tx4xp.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("aircncDb").collection("users");
    const roomsCollection = client.db("aircncDb").collection("rooms");
    const bookingsCollection = client.db("aircncDb").collection("bookings");

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
    app.get('/users/:email', async(req,res)=>{
      const email = req.params.email;
      const query = {email: email}
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    })

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
    app.post('/addRooms' , async(req,res)=>{
      const room = req.body ;
      const result = await roomsCollection.insertOne(room)
      res.send(result)
    })

    // get all rooms 
    app.get('/rooms', async(req,res)=>{
      const result = await roomsCollection.find().toArray();
      res.send(result)
    })

    //getSingleRoom 

    app.get('/rooms/:id', async(req,res)=>{
      const id = req.params.id ;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    })

    
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
