require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Verify essential environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'ADMIN_EMAIL',
  'FROM_EMAIL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority'
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const db = mongoose.connection;

// Email transporter setup
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
    tls: {
    rejectUnauthorized: false // Only for testing with self-signed certs
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000    // 10 seconds
});

// Verify email connection
emailTransporter.verify((error) => {
  if (error) {
    console.error('Error connecting to email server:', error);
  } else {
    console.log('Email server connection verified');
  }
});

// Multer setup for file uploads
const upload = multer();

// Room Schema
const roomSchema = new mongoose.Schema({
  type: { type: String, enum: ['AC', 'Non-AC', 'General'], required: true },
  roomNumber: { type: String, required: true, unique: true },
  isAvailable: { type: Boolean, default: true },
  price: { type: Number, required: true },
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);

// Booking Schema
const bookingSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },
  customerAddress: { type: String },
  roomType: { type: String, enum: ['AC', 'Non-AC', 'General'], required: true },
  selectedRooms: [{
    roomNumber: { type: String, required: true },
    price: { type: Number, required: true }
  }],
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  arrivalTime: { type: Date },
  totalAmount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  paymentMethod: { type: String, enum: ['online', 'cash'], default: 'online' },
  paymentProof: {
    data: Buffer,
    contentType: String
  },
  specialRequests: { type: String },
  bookingDate: { type: Date, default: Date.now },
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);

// Admin credentials
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

// Initialize rooms
async function initializeRooms() {
  try {
    const roomCount = await Room.estimatedDocumentCount();
    
    if (roomCount === 0) {
      const rooms = [
        // AC Rooms (4)
        ...Array.from({ length: 4 }, (_, i) => ({
          type: 'AC',
          roomNumber: `AC-${i+1}`,
          isAvailable: true,
          price: 2500
        })),
        // Non-AC Rooms (4)
        ...Array.from({ length: 4 }, (_, i) => ({
          type: 'Non-AC',
          roomNumber: `NAC-${i+1}`,
          isAvailable: true,
          price: 1800
        })),
        // General Rooms (4)
        ...Array.from({ length: 4 }, (_, i) => ({
          type: 'General',
          roomNumber: `GEN-${i+1}`,
          isAvailable: true,
          price: 1200
        }))
      ];
      
      await Room.insertMany(rooms);
      console.log('Successfully initialized rooms');
    } else {
      console.log('Rooms already exist in database');
    }
  } catch (error) {
    console.error('Error initializing rooms:', error);
    setTimeout(initializeRooms, 5000);
  }
}

// Function to send booking emails
async function sendBookingEmails(booking, rooms) {
  try {
    const checkInDate = booking.checkInDate.toDateString();
    const checkOutDate = booking.checkOutDate.toDateString();
    const roomNumbers = booking.selectedRooms.map(r => r.roomNumber).join(', ');
    const arrivalTime = booking.arrivalTime ? new Date(booking.arrivalTime).toLocaleTimeString() : 'Not specified';
    
    // Customer email
    if (booking.customerEmail) {
      const customerMailOptions = {
        from: `"Hotel Booking System" <${process.env.FROM_EMAIL}>`,
        to: booking.customerEmail,
        subject: 'Your Booking Confirmation',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2c3e50;">Thank you for your booking, ${booking.customerName}!</h1>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
              <h2 style="color: #3498db;">Booking Details</h2>
              <p><strong>Booking ID:</strong> ${booking._id}</p>
              <p><strong>Room Type:</strong> ${booking.roomType}</p>
              <p><strong>Room Numbers:</strong> ${roomNumbers}</p>
              <p><strong>Check-in Date:</strong> ${checkInDate}</p>
              <p><strong>Check-out Date:</strong> ${checkOutDate}</p>
              <p><strong>Arrival Time:</strong> ${arrivalTime}</p>
              <p><strong>Total Amount:</strong> ₹${booking.totalAmount}</p>
              <p><strong>Payment Status:</strong> ${booking.paymentStatus}</p>
              <p><strong>Payment Method:</strong> ${booking.paymentMethod}</p>
            </div>
            <p style="margin-top: 20px;">If you have any questions or need to modify your booking, please contact us.</p>
            <p>We look forward to serving you!</p>
            <p style="margin-top: 30px; font-size: 0.9em; color: #7f8c8d;">This is an automated message. Please do not reply directly to this email.</p>
          </div>
        `
      };

      await emailTransporter.sendMail(customerMailOptions);
      console.log('Customer confirmation email sent');
    }

    // Admin email
    const adminMailOptions = {
      from: `"Hotel Booking System" <${process.env.FROM_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `New Booking: ${booking.customerName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2c3e50;">New Booking Received</h1>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="color: #3498db;">Customer Details</h2>
            <p><strong>Name:</strong> ${booking.customerName}</p>
            <p><strong>Phone:</strong> ${booking.customerPhone}</p>
            <p><strong>Email:</strong> ${booking.customerEmail || 'Not provided'}</p>
            <p><strong>Address:</strong> ${booking.customerAddress || 'Not provided'}</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #3498db;">Booking Details</h2>
            <p><strong>Booking ID:</strong> ${booking._id}</p>
            <p><strong>Room Type:</strong> ${booking.roomType}</p>
            <p><strong>Room Numbers:</strong> ${roomNumbers}</p>
            <p><strong>Check-in Date:</strong> ${checkInDate}</p>
            <p><strong>Check-out Date:</strong> ${checkOutDate}</p>
            <p><strong>Arrival Time:</strong> ${arrivalTime}</p>
            <p><strong>Total Amount:</strong> ₹${booking.totalAmount}</p>
            <p><strong>Payment Status:</strong> ${booking.paymentStatus}</p>
            <p><strong>Payment Method:</strong> ${booking.paymentMethod}</p>
            <p><strong>Special Requests:</strong> ${booking.specialRequests || 'None'}</p>
          </div>
        </div>
      `
    };

    await emailTransporter.sendMail(adminMailOptions);
    console.log('Admin notification email sent');
  } catch (error) {
    console.error('Email sending error:', error);
  }
}

// Routes
app.get('/api/health', (req, res) => {
  const status = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
  res.json({
    status,
    dbState: mongoose.STATES[mongoose.connection.readyState],
    timestamp: new Date()
  });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Get all bookings with pagination
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const bookings = await Booking.find()
      .sort({ bookingDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const count = await Booking.countDocuments();
    
    res.json({
      bookings,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get available rooms by type
app.get('/api/rooms/available/:type', async (req, res) => {
  try {
    if (!['AC', 'Non-AC', 'General'].includes(req.params.type)) {
      return res.status(400).json({ message: 'Invalid room type' });
    }
    
    const availableRooms = await Room.find({
      type: req.params.type,
      isAvailable: true
    });
    res.json(availableRooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create booking with validation
app.post('/api/bookings', upload.single('paymentProof'), async (req, res) => {
  try {
    const { 
      customerName, 
      customerPhone, 
      customerEmail,
      customerAddress,
      roomType, 
      selectedRooms,
      checkInDate, 
      checkOutDate,
      arrivalTime,
      specialRequests,
      paymentMethod
    } = req.body;
    
    // Validate input
    if (!customerName || !customerPhone || !roomType || !selectedRooms || !checkInDate || !checkOutDate) {
      return res.status(400).json({ message: 'All required fields are missing' });
    }
    
    // Parse the selected rooms
    const rooms = JSON.parse(selectedRooms);
    if (!Array.isArray(rooms)) {
      return res.status(400).json({ message: 'Invalid room selection' });
    }
    
    // Validate all rooms are available
    for (const room of rooms) {
      const roomDoc = await Room.findOne({ roomNumber: room.roomNumber });
      if (!roomDoc || !roomDoc.isAvailable || roomDoc.type !== roomType) {
        return res.status(400).json({ message: `Room ${room.roomNumber} not available or type mismatch` });
      }
    }
    
    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    if (checkIn >= checkOut) {
      return res.status(400).json({ message: 'Check-out date must be after check-in date' });
    }
    
    // Calculate total amount
    const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const totalAmount = days * rooms.reduce((sum, room) => sum + room.price, 0);
    
    // Create booking
    const booking = new Booking({
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      roomType,
      selectedRooms: rooms,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      arrivalTime: arrivalTime ? new Date(arrivalTime) : null,
      totalAmount,
      paymentMethod,
      specialRequests
    });
    
    // Add payment proof if uploaded
    if (req.file) {
      booking.paymentProof = {
        data: req.file.buffer,
        contentType: req.file.mimetype
      };
    }
    
    // Update room availability in a transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Mark all selected rooms as unavailable
      await Room.updateMany(
        { roomNumber: { $in: rooms.map(r => r.roomNumber) } },
        { $set: { isAvailable: false } },
        { session }
      );
      
      const savedBooking = await booking.save({ session });
      
      await session.commitTransaction();
      
      // Send email notifications
      sendBookingEmails(savedBooking, rooms)
        .catch(err => console.error('Email sending failed:', err));
      
      res.status(201).json(savedBooking);
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Complete payment
app.put('/api/bookings/:id/payment', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (booking.paymentStatus === 'Completed') {
      return res.status(400).json({ message: 'Payment already completed' });
    }
    
    booking.paymentStatus = 'Completed';
    const updatedBooking = await booking.save();
    
    res.json(updatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Checkout and make room available
app.put('/api/bookings/:id/checkout', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find and update all rooms in the booking
      await Room.updateMany(
        { roomNumber: { $in: booking.selectedRooms.map(r => r.roomNumber) } },
        { $set: { isAvailable: true } },
        { session }
      );
      
      await session.commitTransaction();
      res.json({ 
        message: 'Checkout successful', 
        roomNumbers: booking.selectedRooms.map(r => r.roomNumber) 
      });
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server only after MongoDB is connected
db.once('open', () => {
  console.log('Connected to MongoDB');
  initializeRooms();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Handle MongoDB connection errors
db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
