const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iuv9m.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctor_portal").collection("services");
    const bookingCollection = client.db("doctor_portal").collection("booking");
    const userCollection = client.db("doctor_portal").collection("users");
    const reviewCollection = client.db("doctor_portal").collection("reviews");
    const doctorsCollection = client.db("doctor_portal").collection("doctors");
    const paymentCollection = client.db("doctor_portal").collection("payments");

    // service get
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // apponitment available get
    app.get("/available", async (req, res) => {
      const date = req.query.date;

      const services = await serviceCollection.find().toArray();

      const query = { date: date };

      const booking = await bookingCollection.find(query).toArray();

      services.forEach((service) => {
        const serviceBooking = booking.filter(
          (book) => book.treatment === service.name
        );
        const bookedSlots = serviceBooking.map((book) => book.slot);
        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        service.slots = available;
      });
      res.send(services);
    });

    // user collection
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "5h" }
      );
      res.send({ result, token });
    });

    // booking collection get
    app.get("/booking", async (req, res) => {
      const patient = req.query.patient;
      const query = { paitent: patient };
      const booking = await bookingCollection.find(query).toArray();
      return res.send(booking);
    });

    // particuler booking
    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    });

    //booking collection post
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });
    });
    // booking collection end

    // doctor collection //
    app.get("/doctor", async (req, res) => {
      const query = {};
      const cursor = doctorsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //doctor post
    app.post("/doctor", async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      return res.send(result);
    });
    // doctor collection end //

    // user Get
    app.get("/user", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // make admin
    app.put("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //update user
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updateDoc = {
        $set: { user },
      };
      const result = await userCollection.updateOne(filter, updateDoc, option);
      res.send({ result });
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // delete user
    app.delete("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // delete booking
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    //get review
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const reviews = await cursor.toArray();
      return res.send(reviews);
    });

    // add review
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      return res.send(result);
    });

    // payment booking update
    app.patch("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updateBooking = await bookingCollection.updateOne(
        filter,
        updateDoc
      );
      const result = await paymentCollection.insertOne(payment);
      res.send(updateDoc);
    });

    // payment method
    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Doctor Uncle");
});

app.listen(port, () => {
  console.log("doctor app listening on port");
});
