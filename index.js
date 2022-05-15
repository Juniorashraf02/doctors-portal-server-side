const express = require('express');
const app = express();
const port = process.env.PORT || 5000;


// middleware
const cors = require('cors');
app.use(cors());
app.use(express.json());
require('dotenv').config();



// application connec

const { MongoClient, ServerApiVersion } = require('mongodb');
const res = require('express/lib/response');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d0pnn.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors_portal').collection('services');
        const bookingsCollection = client.db('doctors_portal').collection('bookings');

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

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

        app.get('/bookings', async (req, res) => {
            const patient = req.query.patient;
            const query = { patient: patient };
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
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