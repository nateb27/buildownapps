const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize bookings file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ bookings: [] }, null, 2));
}

// Helper functions
function readBookings() {
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

function writeBookings(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// API Routes

// Get all bookings
app.get('/api/bookings', (req, res) => {
  try {
    const data = readBookings();
    res.json(data.bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read bookings' });
  }
});

// Get bookings for a specific date range
app.get('/api/bookings/range', (req, res) => {
  try {
    const { start, end } = req.query;
    const data = readBookings();
    const filtered = data.bookings.filter(booking => {
      return booking.date >= start && booking.date <= end;
    });
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read bookings' });
  }
});

// Create a new booking
app.post('/api/bookings', (req, res) => {
  try {
    const { date, startTime, endTime, bookedBy, notes, court } = req.body;

    // Validation
    if (!date || !startTime || !endTime || !bookedBy || !court) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const data = readBookings();

    // Check for conflicts (only within the same court)
    const hasConflict = data.bookings.some(booking => {
      if (booking.date !== date) return false;
      if (booking.court !== court) return false;
      // Check time overlap
      return (startTime < booking.endTime && endTime > booking.startTime);
    });

    if (hasConflict) {
      return res.status(409).json({ error: 'Time slot already booked' });
    }

    const newBooking = {
      id: Date.now().toString(),
      date,
      startTime,
      endTime,
      bookedBy: bookedBy.trim(),
      notes: notes?.trim() || '',
      court,
      createdAt: new Date().toISOString()
    };

    data.bookings.push(newBooking);
    writeBookings(data);

    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Delete a booking
app.delete('/api/bookings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = readBookings();

    const index = data.bookings.findIndex(b => b.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    data.bookings.splice(index, 1);
    writeBookings(data);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Padel Court Booking app running at http://localhost:${PORT}`);
});
