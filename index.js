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
  origin: 'http://localhost:3000', // your frontend URL
  credentials: true // if using cookies or auth headers
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

// Room Schema
const roomSchema = new mongoose.Schema({
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
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Check-in:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${formatDate(booking.checkInDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Check-out:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${formatDate(booking.checkOutDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Total Nights:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${nights}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Total Amount:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">₹${booking.totalAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px;"><strong>Status:</strong></td>
                  <td style="padding: 8px;">Confirmed</td>
                </tr>
              </table>
              
              <h3 style="color: #4a6baf; margin-top: 20px;">Room Details</h3>
              <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 5px; padding: 15px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr>
                      <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e0e0e0;">Room</th>
                      <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e0e0e0;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${roomDetails}
                  </tbody>
                </table>
              </div>
              
              ${booking.specialRequests ? `
              <h3 style="color: #4a6baf; margin-top: 20px;">Special Requests</h3>
              <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 5px; padding: 15px;">
                <p style="margin: 0;">${booking.specialRequests}</p>
              </div>
              ` : ''}
              
              <div style="margin-top: 30px; background-color: #f0f5ff; padding: 15px; border-radius: 5px;">
                <h3 style="color: #4a6baf; margin-top: 0;">Hotel Information</h3>
                <p style="margin: 5px 0;"><strong>Address:</strong> ${process.env.HOTEL_ADDRESS}</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> ${process.env.HOTEL_PHONE}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${process.env.FROM_EMAIL}</p>
              </div>
              
              <div style="margin-top: 30px; text-align: center; color: #666; font-size: 14px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
                <p>Thank you for choosing ${process.env.HOTEL_NAME}! We look forward to serving you.</p>
                <p>Please present this confirmation at check-in.</p>
              </div>
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
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Total Nights:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${nights}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Payment Method:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.paymentMethod === 'online' ? 'Online Payment' : 'Pay at Hotel'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;"><strong>Payment Status:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${booking.paymentStatus === 'Completed' ? 'Paid' : 'Pending'}</td>
              </tr>
              <tr>
                <td style="padding: 8px;"><strong>Total Amount:</strong></td>
                <td style="padding: 8px;"><strong>₹${booking.totalAmount}</strong></td>
              </tr>
            </table>
            
            <h3 style="color: #d9534f; margin-top: 20px;">Room Details</h3>
            <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 5px; padding: 15px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr>
                    <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e0e0e0;">Room</th>
                    <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e0e0e0;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${roomDetails}
                </tbody>
              </table>
            </div>
            
            ${booking.specialRequests ? `
            <h3 style="color: #d9534f; margin-top: 20px;">Special Requests</h3>
            <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 5px; padding: 15px;">
              <p style="margin: 0;">${booking.specialRequests}</p>
            </div>
            ` : ''}
            
            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.ADMIN_PANEL_URL || 'http://your-admin-panel.com'}" 
                 style="background-color: #d9534f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View in Admin Panel
              </a>
            </div>
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
          price: 2500,
          capacity: 2,
          amenities: ['AC', 'TV', 'WiFi', 'Attached Bathroom']
        })),
        // Non-AC Rooms (4)
        ...Array.from({ length: 4 }, (_, i) => ({
          type: 'Non-AC',
          roomNumber: `NAC-${i+1}`,
          isAvailable: true,
          price: 1800,
          capacity: 2,
          amenities: ['Fan', 'TV', 'WiFi', 'Attached Bathroom']
        })),
        // General Rooms (4)
        ...Array.from({ length: 4 }, (_, i) => ({
          type: 'General',
          roomNumber: `GEN-${i+1}`,
          isAvailable: true,
          price: 1200,
          capacity: 4,
          amenities: ['Fan', 'Shared Bathroom']
        }))
      ];
      
      await Room.insertMany(rooms);
      console.log('Successfully initialized rooms');
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

    const booking = new Booking({
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      customerEmail: formData.customerEmail || undefined,
      customerAddress: formData.customerAddress || undefined,
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
