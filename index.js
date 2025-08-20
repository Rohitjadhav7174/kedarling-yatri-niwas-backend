require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://kedarlingyatrinivas.com',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Verify essential environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'ADMIN_EMAIL',
  'FROM_EMAIL',
  'HOTEL_NAME',
  'HOTEL_PHONE',
  'HOTEL_ADDRESS'
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

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  logger: true,
  debug: true
});

// Verify email connection on startup
async function verifyEmailConnection() {
  try {
    console.log('Verifying SMTP connection...');
    await emailTransporter.verify();
    console.log('SMTP Server is ready to take our messages');
    return true;
  } catch (error) {
    console.error('SMTP Connection verification failed:', error);
    return false;
  }
}

verifyEmailConnection();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Room Schema - Removed images field since we're using hardcoded paths
const roomSchema = new mongoose.Schema({
  roomCategory: { type: String, enum: ['Suite', 'Standard'], required: true },
  type: { type: String, enum: ['AC', 'Non-AC', 'General'], required: true },
  roomNumber: { type: String, required: true, unique: true },
  isAvailable: { type: Boolean, default: true },
  price: { type: Number, required: true },
  capacity: { type: Number, required: true },
  amenities: { type: [String], default: [] }
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);

// Booking Schema
const bookingSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },
  customerAddress: { type: String },
  roomCategory: { type: String, enum: ['Suite', 'Standard'], required: true },
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
  paymentProof: { type: String },
  specialRequests: { type: String },
  bookingDate: { type: Date, default: Date.now },
  bookingStatus: { type: String, enum: ['Confirmed', 'Cancelled', 'Completed'], default: 'Confirmed' }
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);

// Function to send booking confirmation emails
async function sendBookingEmails(booking) {
  try {
    // Format dates
    const formatDate = (date) => date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formatTime = (time) => time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate nights
    const nights = Math.ceil((booking.checkOutDate - booking.checkInDate) / (1000 * 60 * 60 * 24));

    // Prepare room details
    const roomDetails = booking.selectedRooms.map(room => 
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">Room ${room.roomNumber}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">₹${room.price}/night</td>
      </tr>`
    ).join('');

    // Customer email
    if (booking.customerEmail) {
      const customerMail = {
        from: `"${process.env.HOTEL_NAME}" <${process.env.FROM_EMAIL}>`,
        to: booking.customerEmail,
        subject: `Booking Confirmation #${booking._id.toString().slice(-6)} - ${process.env.HOTEL_NAME}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #4a6baf; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Booking Confirmed!</h1>
              <p style="margin: 5px 0 0; font-size: 16px;">${process.env.HOTEL_NAME}</p>
            </div>
            
            <div style="padding: 20px; background-color: #f9f9f9;">
              <h2 style="color: #4a6baf; margin-top: 0;">Booking Details</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; width: 40%;"><strong>Booking ID:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking._id.toString().slice(-6)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Guest Name:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Room Category:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.roomCategory}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Room Type:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.roomType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Check-in:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${formatDate(booking.checkInDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Check-out:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${formatDate(booking.checkOutDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Nights:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${nights}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Total Amount:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">₹${booking.totalAmount}</td>
                </tr>
              </table>
              
              <h3 style="color: #4a6baf; margin-top: 20px;">Room Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <th style="padding: 8px; border-bottom: 2px solid #4a6baf; text-align: left;">Room Number</th>
                  <th style="padding: 8px; border-bottom: 2px solid #4a6baf; text-align: left;">Price per Night</th>
                </tr>
                ${roomDetails}
              </table>
            </div>
            
            <div style="padding: 20px; background-color: #e8f4f8; border-top: 1px solid #e0e0e0;">
              <h3 style="color: #4a6baf; margin-top: 0;">Contact Information</h3>
              <p style="margin: 5px 0;"><strong>Hotel:</strong> ${process.env.HOTEL_NAME}</p>
              <p style="margin: 5px 0;"><strong>Address:</strong> ${process.env.HOTEL_ADDRESS}</p>
              <p style="margin: 5px 0;"><strong>Phone:</strong> ${process.env.HOTEL_PHONE}</p>
            </div>
          </div>
        `
      };

      await emailTransporter.sendMail(customerMail);
      console.log(`Sent confirmation to customer: ${booking.customerEmail}`);
    }

    // Admin notification
    const adminMail = {
      from: `"${process.env.HOTEL_NAME} Booking System" <${process.env.FROM_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `New Booking: ${booking.customerName} (${booking._id.toString().slice(-6)})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #d9534f; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">New Booking Received</h1>
            <p style="margin: 5px 0 0; font-size: 16px;">${process.env.HOTEL_NAME}</p>
          </div>
          
          <div style="padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #d9534f; margin-top: 0;">Booking Summary</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; width: 40%;"><strong>Booking ID:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking._id.toString().slice(-6)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Guest Name:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.customerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Room Category:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.roomCategory}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Room Type:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.roomType}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Phone:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.customerPhone}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Email:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.customerEmail || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Check-in:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${formatDate(booking.checkInDate)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Check-out:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${formatDate(booking.checkOutDate)}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Nights:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${nights}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Total Amount:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">₹${booking.totalAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Payment Status:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.paymentStatus}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Payment Method:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.paymentMethod}</td>
              </tr>
            </table>
            
            <h3 style="color: #d9534f; margin-top: 20px;">Room Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <th style="padding: 8px; border-bottom: 2px solid #d9534f; text-align: left;">Room Number</th>
                <th style="padding: 8px; border-bottom: 2px solid #d9534f; text-align: left;">Price per Night</th>
              </tr>
              ${roomDetails}
            </table>
            
            ${booking.specialRequests ? `
              <h3 style="color: #d9534f; margin-top: 20px;">Special Requests</h3>
              <p style="background-color: #fff3cd; padding: 10px; border-radius: 4px; border-left: 4px solid #ffeaa7;">
                ${booking.specialRequests}
              </p>
            ` : ''}
          </div>
        </div>
      `
    };

    await emailTransporter.sendMail(adminMail);
    console.log(`Sent notification to admin: ${process.env.ADMIN_EMAIL}`);

    return true;
  } catch (error) {
    console.error('Error sending booking emails:', {
      error: error.message,
      stack: error.stack,
      response: error.response
    });
    return false;
  }
}

// Initialize rooms with Suite and Standard categories
async function initializeRooms() {
  try {
    const roomCount = await Room.estimatedDocumentCount();
    
    if (roomCount === 0) {
      const rooms = [
        // Suite AC Rooms
        { roomCategory: 'Suite', type: 'AC', roomNumber: 'Suite AC 1', price: 2000, capacity: 2, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'AC', roomNumber: 'Suite AC 2', price: 2000, capacity: 3, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'AC', roomNumber: 'Suite AC 3', price: 2000, capacity: 3, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'AC', roomNumber: 'Suite AC 4', price: 2000, capacity: 4, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'AC', roomNumber: 'Suite AC 5', price: 2000, capacity: 2, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'AC', roomNumber: 'Suite AC 6', price: 2000, capacity: 2, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'AC', roomNumber: 'Suite AC 7', price: 2200, capacity: 4, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'AC', roomNumber: 'Suite AC 8', price: 2200, capacity: 4, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        
        // Suite Non-AC Rooms
        { roomCategory: 'Suite', type: 'Non-AC', roomNumber: 'Suite Non-AC 1', price: 1500, capacity: 2, amenities: ['Fan', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'Non-AC', roomNumber: 'Suite Non-AC 2', price: 1500, capacity: 3, amenities: ['Fan', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'Non-AC', roomNumber: 'Suite Non-AC 3', price: 1500, capacity: 3, amenities: ['Fan', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'Non-AC', roomNumber: 'Suite Non-AC 4', price: 1500, capacity: 4, amenities: ['Fan', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'Non-AC', roomNumber: 'Suite Non-AC 5', price: 1500, capacity: 2, amenities: ['Fan', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'Non-AC', roomNumber: 'Suite Non-AC 6', price: 1500, capacity: 4, amenities: ['Fan', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'Non-AC', roomNumber: 'Suite Non-AC 7', price: 1800, capacity: 4, amenities: ['Fan', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        { roomCategory: 'Suite', type: 'Non-AC', roomNumber: 'Suite Non-AC 8', price: 1800, capacity: 4, amenities: ['Fan', 'TV', 'WiFi', 'Attached Bathroom', 'Mini Bar', 'Sofa'] },
        
        // Standard AC Rooms
        { roomCategory: 'Standard', type: 'AC', roomNumber: '101', price: 1200, capacity: 2, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom'] },
        { roomCategory: 'Standard', type: 'AC', roomNumber: '102', price: 1200, capacity: 2, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom'] },
        { roomCategory: 'Standard', type: 'AC', roomNumber: '108', price: 1200, capacity: 2, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom'] },
        { roomCategory: 'Standard', type: 'AC', roomNumber: '109', price: 1200, capacity: 2, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom'] },
        { roomCategory: 'Standard', type: 'AC', roomNumber: '110', price: 1200, capacity: 2, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom'] },
        { roomCategory: 'Standard', type: 'AC', roomNumber: '111', price: 1200, capacity: 2, amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom'] },
        
        // Standard Non-AC Rooms
        { roomCategory: 'Standard', type: 'Non-AC', roomNumber: '103', price: 1000, capacity: 2, amenities: ['Fan', 'TV', 'Attached Bathroom'] },
        { roomCategory: 'Standard', type: 'Non-AC', roomNumber: '104', price: 1000, capacity: 2, amenities: ['Fan', 'TV', 'Attached Bathroom'] },
        { roomCategory: 'Standard', type: 'Non-AC', roomNumber: '105', price: 1000, capacity: 2, amenities: ['Fan', 'TV', 'Attached Bathroom'] },
        { roomCategory: 'Standard', type: 'Non-AC', roomNumber: '106', price: 1000, capacity: 2, amenities: ['Fan', 'TV', 'Attached Bathroom'] },
        { roomCategory: 'Standard', type: 'Non-AC', roomNumber: '107', price: 1000, capacity: 2, amenities: ['Fan', 'TV', 'Attached Bathroom'] },
        
        // Standard General Rooms
        { roomCategory: 'Standard', type: 'General', roomNumber: '112', price: 800, capacity: 4, amenities: ['Fan', 'Shared Bathroom'] },
        { roomCategory: 'Standard', type: 'General', roomNumber: '113', price: 800, capacity: 4, amenities: ['Fan', 'Shared Bathroom'] },
        { roomCategory: 'Standard', type: 'General', roomNumber: '114', price: 800, capacity: 4, amenities: ['Fan', 'Shared Bathroom'] },
        { roomCategory: 'Standard', type: 'General', roomNumber: '115', price: 800, capacity: 4, amenities: ['Fan', 'Shared Bathroom'] },
        { roomCategory: 'Standard', type: 'General', roomNumber: '116', price: 800, capacity: 4, amenities: ['Fan', 'Shared Bathroom'] },
        { roomCategory: 'Standard', type: 'General', roomNumber: '117', price: 800, capacity: 4, amenities: ['Fan', 'Shared Bathroom'] }
      ];
      
      await Room.insertMany(rooms);
      console.log('Successfully initialized rooms with Suite and Standard categories');
    }
  } catch (error) {
    console.error('Error initializing rooms:', error);
  }
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    dbState: mongoose.STATES[mongoose.connection.readyState],
    timestamp: new Date()
  });
});

// Get available rooms by category and type
app.get('/api/rooms/available', async (req, res) => {
  try {
    const { checkIn, checkOut, category, type } = req.query;
    
    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: 'Check-in and check-out dates are required' });
    }
    
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    // Find all bookings that overlap with the requested dates
    const overlappingBookings = await Booking.find({
      $or: [
        { 
          checkInDate: { $lt: checkOutDate },
          checkOutDate: { $gt: checkInDate },
          bookingStatus: { $ne: 'Cancelled' }
        }
      ]
    });
    
    // Get room numbers that are booked
    const bookedRoomNumbers = overlappingBookings.flatMap(booking => 
      booking.selectedRooms.map(room => room.roomNumber)
    );
    
    // Build query for available rooms
    const roomQuery = {
      roomNumber: { $nin: bookedRoomNumbers }
    };
    
    // Add category filter if specified
    if (category) {
      roomQuery.roomCategory = category;
    }
    
    // Add type filter if specified
    if (type) {
      roomQuery.type = type;
    }
    
    // Find available rooms
    const availableRooms = await Room.find(roomQuery);
    
    res.json(availableRooms);
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    res.status(500).json({ message: 'Error fetching available rooms', error: error.message });
  }
});

// Create booking
app.post('/api/bookings', upload.single('paymentProof'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const formData = req.body;
    const selectedRooms = JSON.parse(formData.selectedRooms);

    // Calculate total amount
    const nights = Math.ceil((new Date(formData.checkOutDate) - new Date(formData.checkInDate)) / (1000 * 60 * 60 * 24));
    const totalAmount = selectedRooms.reduce((sum, room) => sum + (room.price * nights), 0);

    // Get room category from the first selected room
    const firstRoom = await Room.findOne({ roomNumber: selectedRooms[0].roomNumber });
    const roomCategory = firstRoom ? firstRoom.roomCategory : 'Standard';

    const booking = new Booking({
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      customerEmail: formData.customerEmail || undefined,
      customerAddress: formData.customerAddress || undefined,
      roomCategory: roomCategory,
      roomType: formData.roomType,
      selectedRooms,
      checkInDate: new Date(formData.checkInDate),
      checkOutDate: new Date(formData.checkOutDate),
      arrivalTime: formData.arrivalTime ? new Date(formData.arrivalTime) : undefined,
      totalAmount,
      paymentMethod: formData.paymentMethod,
      paymentStatus: formData.paymentMethod === 'cash' ? 'Pending' : 'Pending',
      paymentProof: req.file ? `/uploads/${req.file.filename}` : undefined,
      specialRequests: formData.specialRequests || undefined
    });

    const savedBooking = await booking.save({ session });

    // Mark rooms as unavailable
    await Room.updateMany(
      { roomNumber: { $in: selectedRooms.map(r => r.roomNumber) } },
      { $set: { isAvailable: false } },
      { session }
    );

    await session.commitTransaction();

    // Send emails
    const emailSent = await sendBookingEmails(savedBooking);

    res.status(201).json({
      ...savedBooking.toObject(),
      emailSent,
      message: 'Booking created successfully'
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Booking creation error:', error);
    res.status(400).json({ 
      message: 'Failed to create booking',
      error: error.message 
    });
  } finally {
    session.endSession();
  }

});

// Complete payment
app.put('/api/bookings/:id/payment', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: 'Completed' },
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    res.json(booking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Checkout and make room available
app.put('/api/bookings/:id/checkout', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    await Room.updateMany(
      { roomNumber: { $in: booking.selectedRooms.map(r => r.roomNumber) } },
      { $set: { isAvailable: true } },
      { session }
    );
    
    booking.bookingStatus = 'Completed';
    await booking.save({ session });
    
    await session.commitTransaction();
    res.json({ 
      message: 'Checkout successful', 
      roomNumbers: booking.selectedRooms.map(r => r.roomNumber) 
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
db.once('open', () => {
  initializeRooms();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('SMTP Configuration:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      from: process.env.FROM_EMAIL,
      admin: process.env.ADMIN_EMAIL
    });
  });
});
