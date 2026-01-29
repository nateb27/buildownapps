const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data file paths
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');
const ENTRIES_FILE = path.join(__dirname, 'data', 'entries.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize files if they don't exist
if (!fs.existsSync(CONFIG_FILE)) {
  const defaultConfig = {
    "Role 1": {
      "Task 1": ["Subtask A", "Subtask B", "Subtask C"],
      "Task 2": ["Subtask A", "Subtask B"]
    },
    "Role 2": {
      "Task 1": ["Subtask A", "Subtask B"],
      "Task 2": ["Subtask A", "Subtask B", "Subtask C"]
    }
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
}

if (!fs.existsSync(ENTRIES_FILE)) {
  fs.writeFileSync(ENTRIES_FILE, '[]');
}

// Helper functions
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return filePath === ENTRIES_FILE ? [] : {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// API Routes

// Get configuration (roles, tasks, subtasks)
app.get('/api/config', (req, res) => {
  const config = readJSON(CONFIG_FILE);
  res.json(config);
});

// Update configuration
app.post('/api/config', (req, res) => {
  const config = req.body;
  writeJSON(CONFIG_FILE, config);
  res.json({ success: true, config });
});

// Get all entries (with optional date filter)
app.get('/api/entries', (req, res) => {
  const entries = readJSON(ENTRIES_FILE);
  const { date, startDate, endDate } = req.query;

  let filtered = entries;

  if (date) {
    // Filter by specific date
    filtered = entries.filter(entry => {
      const entryDate = new Date(entry.startTime).toISOString().split('T')[0];
      return entryDate === date;
    });
  } else if (startDate && endDate) {
    // Filter by date range
    filtered = entries.filter(entry => {
      const entryDate = new Date(entry.startTime).toISOString().split('T')[0];
      return entryDate >= startDate && entryDate <= endDate;
    });
  }

  res.json(filtered);
});

// Create a new time entry
app.post('/api/entries', (req, res) => {
  const entries = readJSON(ENTRIES_FILE);
  const { name, role, task, subtask, startTime, endTime, duration, note } = req.body;

  const newEntry = {
    id: uuidv4(),
    name: name || 'Anonymous',
    role,
    task,
    subtask,
    startTime,
    endTime,
    duration, // in seconds
    note: note || '',
    createdAt: new Date().toISOString()
  };

  entries.push(newEntry);
  writeJSON(ENTRIES_FILE, entries);

  res.json({ success: true, entry: newEntry });
});

// Delete an entry
app.delete('/api/entries/:id', (req, res) => {
  const entries = readJSON(ENTRIES_FILE);
  const { id } = req.params;

  const index = entries.findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  entries.splice(index, 1);
  writeJSON(ENTRIES_FILE, entries);

  res.json({ success: true });
});

// Export entries as CSV
app.get('/api/export', (req, res) => {
  const entries = readJSON(ENTRIES_FILE);
  const { startDate, endDate } = req.query;

  let filtered = entries;

  if (startDate && endDate) {
    filtered = entries.filter(entry => {
      const entryDate = new Date(entry.startTime).toISOString().split('T')[0];
      return entryDate >= startDate && entryDate <= endDate;
    });
  }

  // Create CSV
  const headers = ['Date', 'Name', 'Role', 'Task', 'Subtask', 'Start Time', 'End Time', 'Duration (minutes)', 'Note'];
  const rows = filtered.map(entry => {
    const startDate = new Date(entry.startTime);
    const endDate = new Date(entry.endTime);
    return [
      startDate.toLocaleDateString(),
      entry.name,
      entry.role,
      entry.task,
      entry.subtask,
      startDate.toLocaleTimeString(),
      endDate.toLocaleTimeString(),
      (entry.duration / 60).toFixed(2),
      entry.note.replace(/"/g, '""') // Escape quotes
    ].map(field => `"${field}"`).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=time-entries.csv');
  res.send(csv);
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Time Tracker running at http://localhost:${PORT}`);
});
