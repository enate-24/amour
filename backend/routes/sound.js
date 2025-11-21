const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

// Sound category persistence file
const SOUND_CATEGORY_FILE = path.join(__dirname, '../data/sound-category.json');

// Function to load sound category from file (only boy allowed)
const loadSoundCategory = () => {
  try {
    if (fs.existsSync(SOUND_CATEGORY_FILE)) {
      const data = fs.readFileSync(SOUND_CATEGORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      console.log(`📁 Loaded sound category from file: ${parsed.category}, timestamp: ${parsed.timestamp}`);
      // Only allow 'boy' category - if anything else is stored, force it to 'boy'
      if (parsed.category !== 'boy') {
        console.log(`⚠️ Invalid category found (${parsed.category}), forcing to 'boy'`);
        saveSoundCategory('boy');
        return 'boy';
      }
      return parsed.category;
    } else {
      console.log(`📁 Sound category file does not exist: ${SOUND_CATEGORY_FILE}`);
    }
  } catch (error) {
    console.error('Error loading sound category:', error);
  }
  console.log(`📁 Using default sound category: boy`);
  return 'boy'; // Default fallback
};

// Function to save sound category to file
const saveSoundCategory = (category) => {
  try {
    // Ensure the data directory exists
    const dataDir = path.dirname(SOUND_CATEGORY_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`📁 Created data directory: ${dataDir}`);
    }

    const data = JSON.stringify({ category, timestamp: new Date().toISOString() });
    fs.writeFileSync(SOUND_CATEGORY_FILE, data, 'utf8');
    console.log(`🎵 Sound category saved to file: ${category}`);
  } catch (error) {
    console.error('Error saving sound category:', error);
  }
};

// Load initial sound category from file
let currentSoundCategory = loadSoundCategory();
console.log(`🎵 Initial sound category loaded: ${currentSoundCategory}`);

// Function to get current sound category (reads from file to ensure persistence)
const getCurrentSoundCategory = () => {
  // Always read from file to ensure we have the latest category
  const category = loadSoundCategory();
  if (category !== currentSoundCategory) {
    console.log(`🎵 Sound category updated from file: ${currentSoundCategory} -> ${category}`);
    currentSoundCategory = category;
  }
  return currentSoundCategory;
};

// Set sound category (only boy allowed)
router.post('/category', (req, res) => {
  try {
    const { category } = req.body;
    console.log(`🎵 Category change request received: ${category}`);

    if (!category || category !== 'boy') {
      console.log(`❌ Invalid category: ${category} - Only 'boy' is allowed`);
      return res.status(400).json({ error: 'Invalid category. Only "boy" is allowed' });
    }

    const oldCategory = currentSoundCategory;
    currentSoundCategory = category;
    saveSoundCategory(category); // Save to file for persistence
    console.log(`🎵 Sound category changed from ${oldCategory} to: ${category}`);

    res.json({
      success: true,
      category: currentSoundCategory,
      message: `Sound category set to ${category}`
    });
  } catch (error) {
    console.error('Error setting sound category:', error);
    res.status(500).json({ error: 'Failed to set sound category' });
  }
});

// Get current sound category
router.get('/category', (req, res) => {
  const category = getCurrentSoundCategory();
  res.json({
    category: category,
    availableCategories: ['boy'] // Only boy is available
  });
});

// Serve individual number sounds
router.get('/number/:number', (req, res) => {
  try {
    const number = parseInt(req.params.number);

    if (isNaN(number) || number < 1 || number > 75) {
      return res.status(400).json({ error: 'Invalid number. Must be between 1-75' });
    }

    // Get current sound category (reads from file to ensure latest)
    const soundCategory = getCurrentSoundCategory();

    // Determine sound directory and file extension based on current category
    const categoryDir = soundCategory === 'girl' ? 'girl sound' : 'men sound';
    const fileExtension = soundCategory === 'girl' ? 'mp3' : 'wav';
    const soundPath = path.join(__dirname, '../data/sound', categoryDir, `${number}.${fileExtension}`);

    console.log(`🔊 Serving number ${number} sound - Category: ${soundCategory}, Dir: ${categoryDir}, File: ${number}.${fileExtension}`);

    // Check if file exists and has content
    if (!fs.existsSync(soundPath)) {
      return res.status(404).json({ error: `Sound file for number ${number} not found in ${currentSoundCategory} category` });
    }

    // Check if file has content (not empty)
    const stats = fs.statSync(soundPath);
    if (stats.size === 0) {
      return res.status(404).json({ error: `Sound file for number ${number} is empty` });
    }

    // Determine content type based on file extension
    const contentType = fileExtension === 'wav' ? 'audio/wav' : 'audio/mpeg';

    // Set CORS headers explicitly for audio streaming
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Accept-Ranges', 'bytes'); // Allow range requests for better audio streaming

    // Send the file with options to handle range requests
    res.sendFile(soundPath, {
      dotfiles: 'deny',
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes'
      }
    }, (err) => {
      if (err) {
        console.error('Error sending number sound file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to serve sound file' });
        }
      }
    });
  } catch (error) {
    console.error('Error serving number sound:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve sound file' });
    }
  }
});

 // Serve winner sound with optional pattern support
router.get('/winner/:pattern?', (req, res) => {
  try {
    // Get current sound category (reads from file to ensure latest)
    const soundCategory = getCurrentSoundCategory();

    // Determine winner sound based on current category
    const categoryDir = soundCategory === 'girl' ? 'girl sound' : 'men sound';
    const soundPath = path.join(__dirname, '../data/sound', categoryDir, 'winner.wav');

    if (!fs.existsSync(soundPath)) {
      return res.status(404).json({ error: `Winner sound file not found for ${soundCategory} category` });
    }

    // Check if file has content (not empty)
    const stats = fs.statSync(soundPath);
    if (stats.size === 0) {
      return res.status(404).json({ error: 'Winner sound file is empty' });
    }

    // Set CORS headers explicitly for audio streaming
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Accept-Ranges', 'bytes'); // Allow range requests for better audio streaming

    res.sendFile(soundPath, {
      dotfiles: 'deny',
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes'
      }
    }, (err) => {
      if (err) {
        console.error('Error sending winner sound file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to serve winner sound' });
        }
      }
    });
  } catch (error) {
    console.error('Error serving winner sound:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve winner sound' });
    }
  }
});

// Serve start sound
router.get('/start', (req, res) => {
  try {
    // Get current sound category (reads from file to ensure latest)
    const soundCategory = getCurrentSoundCategory();

    // Determine start sound based on current category
    const categoryDir = soundCategory === 'girl' ? 'girl sound' : 'men sound';
    const soundPath = path.join(__dirname, '../data/sound', categoryDir, 'start.wav');

    if (!fs.existsSync(soundPath)) {
      return res.status(404).json({ error: `Start sound file not found for ${soundCategory} category` });
    }

    // Check if file has content (not empty)
    const stats = fs.statSync(soundPath);
    if (stats.size === 0) {
      return res.status(404).json({ error: 'Start sound file is empty' });
    }

    // Set CORS headers explicitly for audio streaming
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Accept-Ranges', 'bytes'); // Allow range requests for better audio streaming

    res.sendFile(soundPath, {
      dotfiles: 'deny',
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes'
      }
    }, (err) => {
      if (err) {
        console.error('Error sending start sound file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to serve start sound' });
        }
      }
    });
  } catch (error) {
    console.error('Error serving start sound:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve start sound' });
    }
  }
});

// Serve shuffle sound
router.get('/shuffle', (req, res) => {
  try {
    // Get current sound category (reads from file to ensure latest)
    const soundCategory = getCurrentSoundCategory();

    // Determine shuffle sound based on current category
    const categoryDir = soundCategory === 'girl' ? 'girl sound' : 'men sound';
    const soundPath = path.join(__dirname, '../data/sound', categoryDir, 'shuffle-audio-TfqyAnvz.mp3');

    if (!fs.existsSync(soundPath)) {
      return res.status(404).json({ error: `Shuffle sound file not found for ${soundCategory} category` });
    }

    // Check if file has content (not empty)
    const stats = fs.statSync(soundPath);
    if (stats.size === 0) {
      return res.status(404).json({ error: 'Shuffle sound file is empty' });
    }

    // Set CORS headers explicitly for audio streaming
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Accept-Ranges', 'bytes'); // Allow range requests for better audio streaming

    res.sendFile(soundPath, {
      dotfiles: 'deny',
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes'
      }
    }, (err) => {
      if (err) {
        console.error('Error sending shuffle sound file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to serve shuffle sound' });
        }
      }
    });
  } catch (error) {
    console.error('Error serving shuffle sound:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve shuffle sound' });
    }
  }
});

// Serve not winner sound
router.get('/notwinner', (req, res) => {
  try {
    // Get current sound category (reads from file to ensure latest)
    const soundCategory = getCurrentSoundCategory();

    // Determine not winner sound based on current category
    const categoryDir = soundCategory === 'girl' ? 'girl sound' : 'men sound';
    const soundPath = path.join(__dirname, '../data/sound', categoryDir, 'notwinner.wav');

    if (!fs.existsSync(soundPath)) {
      return res.status(404).json({ error: `Not winner sound file not found for ${soundCategory} category` });
    }

    // Check if file has content (not empty)
    const stats = fs.statSync(soundPath);
    if (stats.size === 0) {
      return res.status(404).json({ error: 'Not winner sound file is empty' });
    }

    // Set CORS headers explicitly for audio streaming
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Accept-Ranges', 'bytes'); // Allow range requests for better audio streaming

    res.sendFile(soundPath, {
      dotfiles: 'deny',
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes'
      }
    }, (err) => {
      if (err) {
        console.error('Error sending not winner sound file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to serve not winner sound' });
        }
      }
    });
  } catch (error) {
    console.error('Error serving not winner sound:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve not winner sound' });
    }
  }
});

// Get sound configuration/status
router.get('/status', (req, res) => {
  try {
    const soundDir = path.join(__dirname, '../data/number-sound/sound');
    const winnerSound = path.join(__dirname, '../data/number-sound/amwinner-BVAmt_Cy.mp3');
    const shuffleSound = path.join(__dirname, '../data/number-sound/shuffle-audio-TfqyAnvz.mp3');

    // Check which sound files exist
    const availableSounds = [];
    for (let i = 1; i <= 75; i++) {
      const soundPath = path.join(soundDir, `${i}.mp3`);
      if (fs.existsSync(soundPath)) {
        availableSounds.push(i);
      }
    }

    const status = {
      numberSounds: {
        total: 75,
        available: availableSounds.length,
        availableNumbers: availableSounds,
        missingNumbers: Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !availableSounds.includes(n))
      },
      specialSounds: {
        winner: fs.existsSync(winnerSound),
        shuffle: fs.existsSync(shuffleSound)
      },
      allComplete: availableSounds.length === 75 && fs.existsSync(winnerSound) && fs.existsSync(shuffleSound)
    };

    res.json(status);
  } catch (error) {
    console.error('Error checking sound status:', error);
    res.status(500).json({ error: 'Failed to check sound status' });
  }
});

// List all available sounds (for debugging)
router.get('/list', (req, res) => {
  try {
    const soundDir = path.join(__dirname, '../data/number-sound/sound');
    const winnerSound = path.join(__dirname, '../data/number-sound/amwinner-BVAmt_Cy.mp3');
    const shuffleSound = path.join(__dirname, '../data/number-sound/shuffle-audio-TfqyAnvz.mp3');

    const files = fs.readdirSync(soundDir);
    const numberFiles = files.filter(f => f.endsWith('.mp3') && /^\d+\.mp3$/.test(f));

    const soundList = {
      numberSounds: numberFiles.map(f => parseInt(f.replace('.mp3', ''))).sort((a, b) => a - b),
      specialSounds: {
        winner: fs.existsSync(winnerSound) ? 'amwinner-BVAmt_Cy.mp3' : null,
        shuffle: fs.existsSync(shuffleSound) ? 'shuffle-audio-TfqyAnvz.mp3' : null
      }
    };

    res.json(soundList);
  } catch (error) {
    console.error('Error listing sounds:', error);
    res.status(500).json({ error: 'Failed to list sounds' });
  }
});

module.exports = router;
