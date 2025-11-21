const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db');

const availablePatterns = ['One Line', 'Two Lines', 'Three Lines', 'Full House'];

// GET /api/settings - Get all user settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let settings = await db.userSettings.findByUserId(userId);

    // If no settings exist, create default settings
    if (!settings) {
      await db.userSettings.create(userId, {
        selectedPattern: 'Two Lines',
        betAmount: 10.0,
        houseCutPercentage: 10.0
      });
      settings = await db.userSettings.findByUserId(userId);
    }

    res.json({
      selectedPattern: settings.selectedPattern,
      betAmount: settings.betAmount,
      houseCutPercentage: settings.houseCutPercentage,
      availablePatterns
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// GET /api/settings/pattern - Get the current pattern setting
router.get('/pattern', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let settings = await db.userSettings.findByUserId(userId);

    // If no settings exist, create default settings
    if (!settings) {
      await db.userSettings.create(userId, {
        selectedPattern: 'Two Lines',
        betAmount: 10.0,
        houseCutPercentage: 10.0
      });
      settings = await db.userSettings.findByUserId(userId);
    }

    res.json({
      selectedPattern: settings.selectedPattern,
      availablePatterns
    });
  } catch (error) {
    console.error('Error fetching pattern setting:', error);
    res.status(500).json({ error: 'Failed to fetch pattern setting' });
  }
});

// POST /api/settings/pattern - Save the pattern setting
router.post('/pattern', authenticateToken, async (req, res) => {
  try {
    const { selectedPattern } = req.body;
    const userId = req.user.id;

    // Validate the pattern
    if (!availablePatterns.includes(selectedPattern)) {
      return res.status(400).json({
        error: 'Invalid pattern. Available patterns: ' + availablePatterns.join(', ')
      });
    }

    // Check if settings exist
    let settings = await db.userSettings.findByUserId(userId);

    if (settings) {
      // Update existing settings
      await db.userSettings.update(userId, { selectedPattern });
    } else {
      // Create new settings
      await db.userSettings.create(userId, {
        selectedPattern,
        betAmount: 10.0,
        houseCutPercentage: 10.0
      });
    }

    console.log(`✅ Pattern setting saved for user ${userId}:`, selectedPattern);

    res.json({
      success: true,
      message: 'Pattern setting saved successfully',
      selectedPattern
    });
  } catch (error) {
    console.error('Error saving pattern setting:', error);
    res.status(500).json({ error: 'Failed to save pattern setting' });
  }
});

// POST /api/settings - Save all user settings
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { selectedPattern, betAmount, houseCutPercentage } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (selectedPattern && !availablePatterns.includes(selectedPattern)) {
      return res.status(400).json({
        error: 'Invalid pattern. Available patterns: ' + availablePatterns.join(', ')
      });
    }

    if (betAmount !== undefined && (isNaN(betAmount) || betAmount < 0)) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }

    if (houseCutPercentage !== undefined && (isNaN(houseCutPercentage) || houseCutPercentage < 0 || houseCutPercentage > 100)) {
      return res.status(400).json({ error: 'Invalid house cut percentage (must be 0-100)' });
    }

    // Check if settings exist
    let settings = await db.userSettings.findByUserId(userId);

    const updateData = {};
    if (selectedPattern !== undefined) updateData.selectedPattern = selectedPattern;
    if (betAmount !== undefined) updateData.betAmount = parseFloat(betAmount);
    if (houseCutPercentage !== undefined) updateData.houseCutPercentage = parseFloat(houseCutPercentage);

    if (settings) {
      // Update existing settings
      await db.userSettings.update(userId, updateData);
    } else {
      // Create new settings with defaults for missing values
      await db.userSettings.create(userId, {
        selectedPattern: selectedPattern || 'Two Lines',
        betAmount: betAmount !== undefined ? parseFloat(betAmount) : 10.0,
        houseCutPercentage: houseCutPercentage !== undefined ? parseFloat(houseCutPercentage) : 10.0
      });
    }

    // Fetch updated settings
    settings = await db.userSettings.findByUserId(userId);

    console.log(`✅ Settings saved for user ${userId}:`, settings);

    res.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        selectedPattern: settings.selectedPattern,
        betAmount: settings.betAmount,
        houseCutPercentage: settings.houseCutPercentage
      }
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
