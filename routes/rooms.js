import { Router } from 'require';
const router = Router();
import { find } from '../models/Room';

// Get all available rooms
router.get('/available', async (req, res) => {
  try {
    const { checkIn, checkOut, roomType } = req.query;
    
    let query = { isAvailable: true };
    if (roomType) {
      query.roomType = roomType;
    }

    const rooms = await find(query);
    
    // Filter rooms that are available for the requested dates
    const availableRooms = rooms.filter(room => {
      return room.bookedDates.every(booking => {
        return new Date(checkOut) <= new Date(booking.checkIn) || 
               new Date(checkIn) >= new Date(booking.checkOut);
      });
    });

    res.json(availableRooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;