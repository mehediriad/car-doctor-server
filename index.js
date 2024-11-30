import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import jwt from "jsonwebtoken"
import cookieParser from "cookie-parser"
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import axios from "axios"

dotenv.config()

const port = process.env.PORT || 5000;

const app = express()

app.use(express.json())
app.use(express.urlencoded())
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

// const verifyToken = (req, res, next) => {
//   const token = req.cookies.token;
//   if (!token) {
//     return res.status(401).send({ message: 'unauthorized' })
//   }

//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
//     if (error) {
//       return res.status(401).send({ message: 'unauthorized' })
//     }
//     req.user = decoded
//     next()
//   })


// }

// app.post("/jwt", (req, res) => {
//   const userInfo = req.body;

//   const token = jwt.sign(userInfo, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
//   res.cookie("token", token, {
//     httpOnly: true,
//     secure: false,
//     maxAge: 86400 * 1000,
//   })
//   res.send({ success: true })
// })


const verifyToken = (req , res ,next) =>{
  const token = req.cookies.token;
 
  
  if(!token){
    return res.status(401).send({message:"unauthorized access"})
  }

  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (error , decoded)=>{
      if(error){
        return res.status(401).send({message:"unauthorized access"})
      }
      req.body.user = decoded
      next()
  })
  
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db("carDoctorDB").collection("services");
    const bookingCollection = client.db("carDoctorDB").collection("booking");



    app.post("/login",async ( req , res )=>{
      const userData = req.body;
      const token =  jwt.sign(userData,process.env.ACCESS_TOKEN_SECRET,{expiresIn: '1h'})
      res.cookie("token",token,{
        httpOnly:true,
        secure:true
      })
      .send({success:true})
    })
    app.post("/logout",async ( req , res )=>{
      const userData = req.body;
      
      res.clearCookie("token",{
        maxAge:0,
       
      })
      .send({success:true})
    })


    app.post("/create-payment/:id", async (req, res) => {
      const checkOutData = req.body;
      const bookingId = req.params?.id

      const tnx_id = new ObjectId().toString();
      const paymentData = {
        store_id: process.env.STORE_ID,
        store_passwd: process.env.STORE_KEY,
        total_amount: parseInt(checkOutData.price) * 125,
        currency: 'BDT',
        tran_id: tnx_id,
        success_url: 'http://localhost:5000/payment-success',
        fail_url: 'http://localhost:5000/payment-fail',
        cancel_url: 'http://localhost:5000/payment-cancel',
        cus_name: 'Customer Name',
        cus_email: 'cust@yahoo.com',
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: 1000,
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        product_name: "Laptop",
        product_category: "Laptop",
        product_profile: "new item",
        shipping_method: 'NO',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
        multi_card_name: 'mastercard,visacard,amexcard',
        value_a: 'ref001_A',
        value_b: 'ref002_B',
        value_c: 'ref003_C',
        value_d: 'ref004_D'
      };

      const directApiUrl = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';

      const response = await axios.post(directApiUrl, paymentData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', // Ensure it's URL encoded
        },
      });

      const query = { _id: new ObjectId(bookingId) }

      const updateData = {
        $set: {
          payment: {
            paymentStatus: "pending",
            transactionId: tnx_id
          }
        }
      }

      let result;
      if (response.data.GatewayPageURL) {
        result = await bookingCollection.updateOne(query, updateData)
      }

      if (result?.modifiedCount > 0) {
        res.send({ redirectURL: response.data.GatewayPageURL })
      }
    })

    app.post("/payment-success", async (req, res) => {
      const successData = req.body;

      if (successData.status === "VALID") {
        const query = { "payment.transactionId": successData.tran_id }

        // const updateData = {
        //   $set:{
        //     payment: {
        //       paymentStatus: "success",
        //       method: successData.card_issuer
        //     }
        //   }
        // }
        const updateData = {
          $set: { "payment.paymentStatus": "success", "payment.method": successData.card_issuer }
        }




        const result = await bookingCollection.updateOne(query, updateData)
        console.log(result);

      }
      console.log("successData", successData);

      res.redirect("http://localhost:5173/payment-success")

    })
    app.post("/payment-fail", (req, res) => {
      console.log(req.body);

      res.redirect("http://localhost:5173/payment-fail")
    })
    app.post("/payment-cancel", (req, res) => {
      res.redirect("http://localhost:5173/payment-cancel")
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
    app.get("/booking/:uid",verifyToken, async (req, res) => {

      const uid = req.params?.uid;
      const query = { _id: new ObjectId(uid) }

      const result = await bookingCollection.findOne(query)
      res.send(result)
    })
    app.get("/booking",verifyToken, async (req, res) => {

      const loggedUser = req.body.user?.email
      const reqUser = req.query?.email
      
      
      let query = {}

      if (reqUser) {
        if(reqUser !== loggedUser){
          return res.status(403).send({message:"forbidden access"})
        }
        query = { email: reqUser }
      } 

      if(!reqUser){
        if(loggedUser !== "mhriad.cse@gmail.com"){
          return res.status(403).send({message:"forbidden access"})
        }
        
      }


      // if (req.query?.email) {
      //   if (req.query?.email !== req?.user?.email) {
      //     return res.status(403).send({ message: "forbidden" })
      //   }
      //   query = { email: req.query?.email }
      // } else {
      //   if (req?.user?.email !== "mhriad.cse@gmail.com") {
      //     return res.status(403).send({ message: "forbidden" })
      //   }
      // }



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
