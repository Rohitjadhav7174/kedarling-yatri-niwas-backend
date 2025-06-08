// const mongoose = require('mongoose');

// const roomSchema = new mongoose.Schema({
//   roomNumber: { 
//     type: String, 
//     required: true,
//     unique: true,
//     trim: true
//   },
//   roomType: { 
//     type: String, 
//     required: true,
//     enum: ['standard', 'deluxe', 'suite', 'executive', 'presidential']
//   },
//   price: { 
//     type: Number, 
//     required: true,
//     min: 0
//   },
//   capacity: { 
//     type: Number, 
//     required: true,
//     min: 1,
//     max: 4
//   },
//   description: {
//     type: String,
//     trim: true
//   },
//   amenities: [{
//     type: String,
//     enum: ['wifi', 'ac', 'tv', 'minibar', 'bathtub', 'roomservice']
//   }],
//   images: [{
//     type: String
//   }],
//   status: {
//     type: String,
//     enum: ['available', 'booked', 'maintenance'],
//     default: 'available'
//   },
//   quantity: {
//     type: Number,
//     required: true,
//     default: 1,
//     min: [0, 'Quantity cannot be negative']
//   },
// }, {
//   timestamps: true
// });

// module.exports = mongoose.model('Room', roomSchema);



const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomType: {
    type: String,
    enum: ['AC', 'Non-AC', 'General'],
    required: true
  },
  roomNumber: {
    type: String,
    required: true,
    unique: true
  },
  price: {
    type: Number,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  bookedDates: [{
    checkIn: Date,
    checkOut: Date
  }]
});

module.exports = mongoose.model('Room', roomSchema);