const express = require('express');
const app = express();
const port = process.env.PORT || 5000;


// middleware
const cors = require('cors');
app.use(cors());
app.use(express.json());
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);




// application connect

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const res = require('express/lib/response');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d0pnn.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send('unauthorized access!')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send('forbidden access!');
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors_portal').collection('services');
        const bookingsCollection = client.db('doctors_portal').collection('bookings');
        const usersCollection = client.db('doctors_portal').collection('users');
        const doctorsCollection = client.db('doctors_portal').collection('doctors');
        const paymentsCollection = client.db('doctors_portal').collection('payments');

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query).project({ name: 1 });
            const services = await cursor.toArray();
            res.send(services);
        });

        app.get('/users', verifyJWT, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            } else {
                res.status(403).send('forbidden access!')
            }
        }

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            // const requester = req.decoded.email;
            // const requesterAccount = await usersCollection.findOne({ email: requester });
            // if (requesterAccount.role === 'admin') {

            const filter = { email: email };
            // const options = { upsert: true };
            const updateDoc = {

                $set: { role: 'admin' },

            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
            // } else {
            //     res.status(403).send('forbidden access');
            // }

        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.body.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {

                $set: user,

            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
            res.send({ result, token });
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exists = await bookingsCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: 'booking already exists' });
            }
            const result = await bookingsCollection.insertOne(booking);
            res.send({ success: true, booking: 'booking successfull' });
        });

        app.get('/bookings', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            // const authorization = req.headers.authorization;
            // console.log('auth header', authorization);

            const decodedEmail = req.decoded.email;
            if (decodedEmail === patient) {

                const query = { patient: patient };
                const bookings = await bookingsCollection.find(query).toArray();
                res.send(bookings);
            } else {
                return res.status(403).send('forbidden access');
            }
        });

        app.get('/bookings/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingsCollection.findOne(query);
            res.send(result);
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;
            const query = { date: date };
            const services = await servicesCollection.find().toArray();
            const booking = await bookingsCollection.find(query).toArray();

            services.forEach(service => {
                const serviceBookings = booking.filter(book => book.treatment === service.name);
                const bookedSlots = serviceBookings.map(book => book.slot);
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            });
            res.send(services);
        });



        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result);
        });

        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctors = await doctorsCollection.find().toArray();
            res.send(doctors);
        });

        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await doctorsCollection.deleteOne(filter);
            res.send(result);
        });

        app.patch('/bookings/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const payment = req.body;
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const updatedBooking = await bookingsCollection.updateOne(filter, updateDoc);
            const result = await paymentsCollection.insertOne(payment);
            res.send(updateDoc);

        })

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const serive = req.body;
            const price = serive.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });

        })



    }
    finally { }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})