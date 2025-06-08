    import { Router } from 'express';
const router = Router();
import { findOne } from '../models/Admin';
import { sign } from 'jsonwebtoken';

// Admin login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const admin = await findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;