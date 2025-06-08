// // const mongoose = require('mongoose');

// // const bookingSchema = new mongoose.Schema({
// //   roomId: { 
// //     type: mongoose.Schema.Types.ObjectId, 
// //     ref: 'Room', 
// //     required: true 
// //   },
// //   roomNumber: { 
// //     type: String, 
// //     required: true,
// //     trim: true
// //   },
// //   roomType: { 
// //     type: String, 
// //     required: true,
// //     trim: true,
// //     enum: ['standard', 'deluxe', 'suite', 'executive', 'presidential']
// //   },
// //   guestName: { 
// //     type: String, 
// //     required: true,
// //     trim: true
// //   },
// //   guestEmail: { 
// //     type: String, 
// //     required: true,
// //     trim: true,
// //     lowercase: true
// //   },
// //   guestPhone: { 
// //     type: String, 
// //     required: true,
// //     trim: true
// //   },
// //   checkIn: { 
// //     type: Date, 
// //     required: true 
// //   },
// //   checkOut: { 
// //     type: Date, 
// //     required: true 
// //   },
// //   nights: { 
// //     type: Number, 
// //     required: true,
// //     min: 1
// //   },
// //   adults: { 
// //     type: Number, 
// //     required: true,
// //     min: 1
// //   },
// //   children: { 
// //     type: Number, 
// //     default: 0,
// //     min: 0
// //   },
// //   totalAmount: { 
// //     type: Number, 
// //     required: true,
// //     min: 0
// //   },
// //   status: { 
// //     type: String, 
// //     default: 'confirmed', 
// //     enum: ['confirmed', 'cancelled', 'pending'],
// //     lowercase: true
// //   },
// //   specialRequests: {
// //     type: String,
// //     trim: true
// //   },
// //   gstNumber: {
// //     type: String,
// //     trim: true
// //   },
// //   paymentMethod: {
// //     type: String,
// //     enum: ['credit', 'debit', 'upi', 'netbanking', 'payatproperty'],
// //     default: 'credit'
// //   },
// //   arrivalTime: {
// //     type: String
// //   },
// //   createdAt: { 
// //     type: Date, 
// //     default: Date.now 
// //   }
// // }, {
// //   timestamps: true
// // });

// // module.exports = mongoose.model('Booking', bookingSchema);

// const mongoose = require('mongoose');

// const bookingSchema = new mongoose.Schema({
//   roomId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Room',
//     required: [true, 'Room ID is required']
//   },
//   roomNumber: {
//     type: String,
//     required: [true, 'Room number is required']
//   },
//   roomType: {
//     type: String,
//     required: [true, 'Room type is required']
//   },
//   guestName: {
//     type: String,
//     required: [true, 'Guest name is required'],
//     trim: true
//   },
//   guestEmail: {
//     type: String,
//     required: [true, 'Guest email is required'],
//     trim: true,
//     lowercase: true
//   },
//   guestPhone: {
//     type: String,
//     required: [true, 'Guest phone is required'],
//     trim: true
//   },
//   checkIn: {
//     type: Date,
//     required: [true, 'Check-in date is required']
//   },
//   checkOut: {
//     type: Date,
//     required: [true, 'Check-out date is required']
//   },
//   nights: {
//     type: Number,
//     required: [true, 'Number of nights is required'],
//     min: [1, 'Must stay at least one night']
//   },
//   adults: {
//     type: Number,
//     required: [true, 'Number of adults is required'],
//     min: [1, 'At least one adult required']
//   },
//   children: {
//     type: Number,
//     default: 0,
//     min: [0, 'Children cannot be negative']
//   },
//   totalAmount: {
//     type: Number,
//     required: [true, 'Total amount is required'],
//     min: [0, 'Total amount must be positive']
//   },
//   paymentStatus: {
//     type: String,
//     enum: ['pending', 'paid', 'refunded', 'cancelled'],
//     default: 'pending'
//   },
//   specialRequests: {
//     type: String,
//     trim: true
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// module.exports = mongoose.model('Booking', bookingSchema);

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  guestName: {
    type: String,
    required: true
  },
  guestPhone: {
    type: String,
    required: true
  },
  guestEmail: {
    type: String
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    enum: ['Google Pay', 'Cash'],
    default: 'Google Pay'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Booking', bookingSchema);