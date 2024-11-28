import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import jwt from "jsonwebtoken"
import cookieParser from "cookie-parser"
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

dotenv.config()

const port = process.env.PORT || 5000;

const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}))





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@express-mongo-curd.khcti.mongodb.net/?retryWrites=true&w=majority&appName=express-mongo-curd`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send({ message: 'unauthorized' })
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: 'unauthorized' })
    }
    req.user = decoded
    next()
  })


}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db("carDoctorDB").collection("services");
    const bookingCollection = client.db("carDoctorDB").collection("booking");

    app.post("/jwt", (req, res) => {
      const userInfo = req.body;

      const token = jwt.sign(userInfo, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        maxAge: 86400 * 1000,
      })
      res.send({ success: true })
    })

    app.get("/services", async (req, res) => {

      const services = serviceCollection.find();
      const result = await services.toArray();
      res.send(result)
    })
    app.get("/services/:id", async (req, res) => {


      const id = req.params.id
      const query = { _id: new ObjectId(id) }

      const result = await serviceCollection.findOne(query);
      res.send(result)
    })

    app.post("/booking", async (req, res) => {
      const bookingData = req.body;
      bookingData.status = "pending"
      const result = await bookingCollection.insertOne(bookingData)
      res.send(result)
    })
    app.get("/booking", verifyToken, async (req, res) => {



      let query = {}

      if (req.query?.email) {
        if (req.query?.email !== req?.user?.email) {
          return res.status(403).send({ message: "forbidden" })
        }
        query = { email: req.query?.email }
      } else {
        if (req?.user?.email !== "mhriad.cse@gmail.com") {
          return res.status(403).send({ message: "forbidden" })
        }
      }



      const result = await bookingCollection.find(query).toArray()
      res.send(result)
    })
    app.delete("/booking/:id", async (req, res) => {

      const id = req.params.id

      const query = { _id: new ObjectId(id) }

      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })
    app.patch("/booking/:id", async (req, res) => {

      const id = req.params.id

      const query = { _id: new ObjectId(id) }

      const updateDoc = {
        $set: {
          status: req.body?.status
        }
      }


      const result = await bookingCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get("/", (req, res) => {
  res.send("Car Doctor Server is Running...")
})

app.listen(port, () => {
  console.log("Car Doctor Server is Running on port:", port);

})
