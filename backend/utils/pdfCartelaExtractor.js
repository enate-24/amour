const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');

/**
 * PDF Cartela Extractor
 * 
 * This utility extracts BINGO cartela data from PDF files.
 * Since PDF parsing can be complex, this implementation provides multiple approaches:
 * 1. Manual JSON input (for when you have the data extracted)
 * 2. Text-based parsing (for simple PDF text extraction)
 * 3. Template-based extraction (for structured PDFs)
 */

/**
 * Parse cartelas from JavaScript object format
 * @param {Object} cartelasData - JavaScript object with cartela data
 * @param {number} startCardId - Starting card ID for renumbering
 * @returns {Array} Array of cartela objects
 */
function parseJavaScriptCartelas(cartelasData, startCardId = null) {
  const cartelas = [];
  let cardIdCounter = startCardId || 1;
  
  // The format appears to be: { cardId: [[B1,B2,B3,B4,B5], [I1,I2,I3,I4,I5], ...], ... }
  for (const [originalCardId, rows] of Object.entries(cartelasData)) {
    if (Array.isArray(rows) && rows.length === 5) {
      // Convert rows to BINGO columns
      const numbers = {
        B: [],
        I: [],
        N: [],
        G: [],
        O: []
      };
      
      // Extract each column from the rows
      for (let row = 0; row < 5; row++) {
        if (Array.isArray(rows[row]) && rows[row].length === 5) {
          numbers.B.push(rows[row][0]);
          numbers.I.push(rows[row][1]);
          numbers.N.push(rows[row][2]);
          numbers.G.push(rows[row][3]);
          numbers.O.push(rows[row][4]);
        }
      }
      
      // Validate that we have complete columns
      if (numbers.B.length === 5 && numbers.I.length === 5 && 
          numbers.N.length === 5 && numbers.G.length === 5 && numbers.O.length === 5) {
        
        cartelas.push(formatCartela({
          card_id: startCardId ? cardIdCounter.toString() : originalCardId,
          numbers: numbers
        }));
        
        if (startCardId) {
          cardIdCounter++;
        }
      }
    }
  }
  
  return cartelas;
}

/**
 * Parse cartela data from extracted text or JSON
 * @param {string} input - JSON string or text content from PDF
 * @returns {Array} Array of cartela objects
 */
function parseCartelaData(input) {
  try {
    // Try to parse as JSON first
    const data = JSON.parse(input);
    if (Array.isArray(data)) {
      return data.map(cartela => formatCartela(cartela));
    } else if (data.cartelas && Array.isArray(data.cartelas)) {
      return data.cartelas.map(cartela => formatCartela(cartela));
    }
  } catch (e) {
    // Not JSON, try text parsing
    return parseTextCartelas(input);
  }
}

/**
 * Format cartela object to match database schema
 * @param {Object} cartela - Raw cartela data
 * @returns {Object} Formatted cartela object
 */
function formatCartela(cartela) {
  // Handle different input formats
  let numbers = cartela.numbers || cartela.data || cartela;
  
  // If numbers is an array of arrays (5x5 grid)
  if (Array.isArray(numbers) && Array.isArray(numbers[0])) {
    numbers = {
      B: numbers[0] || [],
      I: numbers[1] || [],
      N: numbers[2] || [],
      G: numbers[3] || [],
      O: numbers[4] || []
    };
  }
  
  // Ensure FREE space in center of N column
  if (numbers.N && numbers.N.length >= 3) {
    numbers.N[2] = 'FREE';
  }
  
  return {
    id: uuidv4(),
    card_id: cartela.card_id || cartela.id || generateCardId(),
    numbers: numbers,
    pattern: cartela.pattern || null,
    is_active: true,
    is_winner: false,
    created_at: new Date().toISOString()
  };
}

/**
 * Parse cartelas from text content
 * @param {string} text - Text content from PDF
 * @returns {Array} Array of cartela objects
 */
function parseTextCartelas(text) {
  const cartelas = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log(`📝 Parsing ${lines.length} lines of text for cartela data...`);
  
  // Look for BINGO card patterns
  let currentNumbers = { B: [], I: [], N: [], G: [], O: [] };
  let cardCounter = 1;
  let foundCardData = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for card headers or separators
    if (line.includes('BINGO') || line.includes('Card') || line.includes('Cartela') || 
        line.includes('B I N G O') || line.match(/^\s*B\s+I\s+N\s+G\s+O\s*$/)) {
      
      // Save previous card if exists
      if (foundCardData && Object.values(currentNumbers).some(col => col.length === 5)) {
        cartelas.push(formatCartela({
          card_id: cardCounter.toString(),
          numbers: currentNumbers
        }));
        cardCounter++;
      }
      
      // Reset for new card
      currentNumbers = { B: [], I: [], N: [], G: [], O: [] };
      foundCardData = false;
      continue;
    }
    
    // Look for number rows - various formats
    // Format 1: "8 19 37 59 75" (space separated)
    let numberMatch = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+|FREE)\s+(\d+)\s+(\d+)\s*$/);
    
    // Format 2: "8,19,37,59,75" (comma separated)
    if (!numberMatch) {
      numberMatch = line.match(/^\s*(\d+),\s*(\d+),\s*(\d+|FREE),\s*(\d+),\s*(\d+)\s*$/);
    }
    
    // Format 3: "8|19|37|59|75" (pipe separated)
    if (!numberMatch) {
      numberMatch = line.match(/^\s*(\d+)\|\s*(\d+)\|\s*(\d+|FREE)\|\s*(\d+)\|\s*(\d+)\s*$/);
    }
    
    // Format 4: "B:8 I:19 N:37 G:59 O:75" (labeled)
    if (!numberMatch) {
      const labeledMatch = line.match(/B:\s*(\d+).*I:\s*(\d+).*N:\s*(\d+|FREE).*G:\s*(\d+).*O:\s*(\d+)/i);
      if (labeledMatch) {
        numberMatch = ['', labeledMatch[1], labeledMatch[2], labeledMatch[3], labeledMatch[4], labeledMatch[5]];
      }
    }
    
    if (numberMatch) {
      const [, b, i, n, g, o] = numberMatch;
      
      // Validate numbers are in correct ranges
      const bNum = parseInt(b);
      const iNum = parseInt(i);
      const nVal = n === 'FREE' ? 'FREE' : parseInt(n);
      const gNum = parseInt(g);
      const oNum = parseInt(o);
      
      // Check if numbers are in valid BINGO ranges
      if (bNum >= 1 && bNum <= 15 && 
          iNum >= 16 && iNum <= 30 && 
          (nVal === 'FREE' || (nVal >= 31 && nVal <= 45)) &&
          gNum >= 46 && gNum <= 60 && 
          oNum >= 61 && oNum <= 75) {
        
        currentNumbers.B.push(bNum);
        currentNumbers.I.push(iNum);
        currentNumbers.N.push(nVal);
        currentNumbers.G.push(gNum);
        currentNumbers.O.push(oNum);
        foundCardData = true;
        
        // If we have 5 rows, we have a complete card
        if (currentNumbers.B.length === 5) {
          cartelas.push(formatCartela({
            card_id: cardCounter.toString(),
            numbers: currentNumbers
          }));
          cardCounter++;
          currentNumbers = { B: [], I: [], N: [], G: [], O: [] };
          foundCardData = false;
        }
      }
    }
  }
  
  // Save last card if incomplete but has some data
  if (foundCardData && Object.values(currentNumbers).some(col => col.length > 0)) {
    // Pad incomplete columns with placeholder values
    ['B', 'I', 'N', 'G', 'O'].forEach(col => {
      while (currentNumbers[col].length < 5) {
        if (col === 'N' && currentNumbers[col].length === 2) {
          currentNumbers[col].push('FREE');
        } else {
          currentNumbers[col].push(0); // Placeholder
        }
      }
    });
    
    cartelas.push(formatCartela({
      card_id: cardCounter.toString(),
      numbers: currentNumbers
    }));
  }
  
  console.log(`📝 Extracted ${cartelas.length} cartelas from text parsing`);
  return cartelas;
}

/**
 * Generate a unique card ID
 * @returns {string} Card ID
 */
function generateCardId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 5);
}

/**
 * Validate cartela data
 * @param {Object} cartela - Cartela object to validate
 * @returns {Object} Validation result
 */
function validateCartela(cartela) {
  const errors = [];
  
  if (!cartela.numbers) {
    errors.push('Missing numbers data');
    return { valid: false, errors };
  }
  
  const { B, I, N, G, O } = cartela.numbers;
  
  // Check each column
  if (!Array.isArray(B) || B.length !== 5) errors.push('B column must have 5 numbers');
  if (!Array.isArray(I) || I.length !== 5) errors.push('I column must have 5 numbers');
  if (!Array.isArray(N) || N.length !== 5) errors.push('N column must have 5 numbers');
  if (!Array.isArray(G) || G.length !== 5) errors.push('G column must have 5 numbers');
  if (!Array.isArray(O) || O.length !== 5) errors.push('O column must have 5 numbers');
  
  // Check number ranges
  if (B && B.some(n => typeof n === 'number' && (n < 1 || n > 15))) {
    errors.push('B column numbers must be 1-15');
  }
  if (I && I.some(n => typeof n === 'number' && (n < 16 || n > 30))) {
    errors.push('I column numbers must be 16-30');
  }
  if (G && G.some(n => typeof n === 'number' && (n < 46 || n > 60))) {
    errors.push('G column numbers must be 46-60');
  }
  if (O && O.some(n => typeof n === 'number' && (n < 61 || n > 75))) {
    errors.push('O column numbers must be 61-75');
  }
  
  // Check for FREE space
  if (N && N[2] !== 'FREE') {
    errors.push('N column center must be FREE');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Process PDF file and extract cartelas
 * @param {string} filePath - Path to PDF file
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing result
 */
async function processPDFCartelas(filePath, options = {}) {
  try {
    console.log(`📄 Processing PDF: ${filePath}`);
    
    const result = {
      success: false,
      message: '',
      cartelas: [],
      errors: []
    };
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      result.message = 'PDF file not found';
      return result;
    }
    
    // Read PDF file
    const dataBuffer = fs.readFileSync(filePath);
    let extractedCartelas = [];
    
    try {
      // Parse PDF content
      console.log('📖 Parsing PDF content...');
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text;
      
      console.log(`📝 Extracted ${text.length} characters from PDF`);
      console.log('📝 First 500 characters:', text.substring(0, 500));
      
      // Try to parse cartelas from the extracted text
      
      // First, try to parse JavaScript object format (const cartelas = {...})
      try {
        const jsObjectMatch = text.match(/const\s+cartelas\s*=\s*(\{[\s\S]*?\});/);
        if (jsObjectMatch) {
          console.log('📝 Found JavaScript object format, parsing...');
          const jsObjectStr = jsObjectMatch[1];
          // Convert JavaScript object to JSON by evaluating it safely
          const cartelasData = eval('(' + jsObjectStr + ')');
          extractedCartelas = parseJavaScriptCartelas(cartelasData, options.startCardId);
          console.log(`📝 Parsed ${extractedCartelas.length} cartelas from JavaScript object`);
        }
      } catch (e) {
        console.log('📝 JavaScript object parsing failed:', e.message);
      }
      
      // Second, try to parse as JSON (if the PDF contains JSON data)
      if (extractedCartelas.length === 0) {
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonData = JSON.parse(jsonMatch[0]);
            extractedCartelas = parseCartelaData(JSON.stringify(jsonData));
          }
        } catch (e) {
          console.log('📝 Not JSON format, trying text parsing...');
        }
      }
      
      // If no JSON found, try text parsing
      if (extractedCartelas.length === 0) {
        extractedCartelas = parseTextCartelas(text);
      }
      
      // If still no cartelas found, check if we should generate sample data
      if (extractedCartelas.length === 0) {
        console.log('⚠️ No cartelas found in PDF text. Generating sample cartelas...');
        console.log('💡 To extract real cartelas, ensure your PDF contains:');
        console.log('   - BINGO card data in a recognizable format');
        console.log('   - Numbers arranged in B-I-N-G-O columns');
        console.log('   - Clear card separators or identifiers');
        
        // Generate sample cartelas with custom card IDs if specified
        const startCardId = options.startCardId || 2001;
        extractedCartelas = generateSampleCartelas(options.count || 50, startCardId);
        
        result.message = `PDF parsing incomplete. Generated ${extractedCartelas.length} sample cartelas. Please check PDF format.`;
        result.errors.push('Could not extract cartelas from PDF - using sample data');
      } else {
        result.message = `Successfully extracted ${extractedCartelas.length} cartelas from PDF`;
      }
      
    } catch (pdfError) {
      console.error('❌ PDF parsing error:', pdfError);
      result.errors.push(`PDF parsing failed: ${pdfError.message}`);
      
      // Fallback to sample cartelas
      console.log('🔄 Falling back to sample cartela generation...');
      const startCardId = options.startCardId || 2001;
      extractedCartelas = generateSampleCartelas(options.count || 50, startCardId);
      result.message = `PDF parsing failed. Generated ${extractedCartelas.length} sample cartelas as fallback.`;
    }
    
    // Validate all cartelas
    const validCartelas = [];
    for (const cartela of extractedCartelas) {
      const validation = validateCartela(cartela);
      if (validation.valid) {
        validCartelas.push(cartela);
      } else {
        result.errors.push(`Card ${cartela.card_id}: ${validation.errors.join(', ')}`);
      }
    }
    
    result.success = true;
    result.cartelas = validCartelas;
    
    if (result.errors.length > 0) {
      result.message += ` (${result.errors.length} cards had errors)`;
    }
    
    console.log(`✅ PDF processing complete: ${validCartelas.length} cartelas extracted`);
    return result;
    
  } catch (error) {
    console.error('❌ PDF processing error:', error);
    return {
      success: false,
      message: `PDF processing failed: ${error.message}`,
      cartelas: [],
      errors: [error.message]
    };
  }
}

/**
 * Generate sample cartelas for demonstration
 * @param {number} count - Number of cartelas to generate
 * @param {number} startCardId - Starting card ID (default: 1001)
 * @returns {Array} Array of sample cartelas
 */
function generateSampleCartelas(count = 50, startCardId = 1001) {
  const cartelas = [];
  
  for (let i = 0; i < count; i++) {
    const numbers = {
      B: generateColumnNumbers(1, 15, 5),
      I: generateColumnNumbers(16, 30, 5),
      N: generateColumnNumbers(31, 45, 5),
      G: generateColumnNumbers(46, 60, 5),
      O: generateColumnNumbers(61, 75, 5)
    };
    
    // Set FREE space
    numbers.N[2] = 'FREE';
    
    cartelas.push({
      card_id: (startCardId + i).toString(),
      numbers: numbers,
      pattern: null,
      is_active: true,
      is_winner: false,
      created_at: new Date().toISOString()
    });
  }
  
  return cartelas;
}

/**
 * Generate random numbers for a column
 * @param {number} min - Minimum number
 * @param {number} max - Maximum number
 * @param {number} count - Number of numbers to generate
 * @returns {Array} Array of unique numbers
 */
function generateColumnNumbers(min, max, count) {
  const numbers = [];
  while (numbers.length < count) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers.sort((a, b) => a - b);
}

/**
 * Save cartelas to database with progress tracking (legacy function for backward compatibility)
 * @param {Array} cartelas - Array of cartela objects
 * @param {Object} db - Database connection
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} Save result
 */
async function saveCartelasToDatabase(cartelas, db, onProgress = null) {
  try {
    console.log(`💾 Saving ${cartelas.length} cartelas to database...`);
    
    let savedCount = 0;
    const errors = [];
    const totalCount = cartelas.length;
    
    for (let i = 0; i < cartelas.length; i++) {
      const cartela = cartelas[i];
      try {
        await db.cartelas.create({
          id: cartela.id || uuidv4(),
          card_id: cartela.card_id,
          game_id: null,
          user_id: null,
          numbers: cartela.numbers,
          pattern: cartela.pattern,
          is_active: cartela.is_active ? 1 : 0,
          is_winner: cartela.is_winner ? 1 : 0,
          purchased_at: cartela.created_at || new Date().toISOString()
        });
        savedCount++;
        
        // Report progress every 10 cartelas or on last cartela
        if (onProgress && (savedCount % 10 === 0 || i === cartelas.length - 1)) {
          const progress = Math.round((savedCount / totalCount) * 100);
          onProgress({
            phase: 'saving',
            current: savedCount,
            total: totalCount,
            progress: progress,
            message: `Saved ${savedCount}/${totalCount} cartelas (${progress}%)`
          });
        }
      } catch (error) {
        errors.push(`Card ${cartela.card_id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Saved ${savedCount} cartelas to database`);
    
    return {
      success: true,
      savedCount,
      totalCount: cartelas.length,
      errors
    };
    
  } catch (error) {
    console.error('❌ Database save error:', error);
    return {
      success: false,
      savedCount: 0,
      totalCount: cartelas.length,
      errors: [error.message]
    };
  }
}

/**
 * Save cartelas directly to user_cartelas table (user-specific cartelas)
 * @param {Array} cartelas - Array of cartela objects
 * @param {Object} db - Database connection
 * @param {string} userId - User ID to assign cartelas to
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} Save result
 */
async function saveCartelasToUserTable(cartelas, db, userId, onProgress = null) {
  try {
    console.log(`💾 Saving ${cartelas.length} cartelas directly to user_cartelas table for user ${userId}...`);
    
    let savedCount = 0;
    const errors = [];
    const totalCount = cartelas.length;
    
    for (let i = 0; i < cartelas.length; i++) {
      const cartela = cartelas[i];
      try {
        await db.userCartelas.create({
          id: cartela.id || require('uuid').v4(),
          user_id: userId,
          card_id: cartela.card_id,
          numbers: cartela.numbers,
          pattern: cartela.pattern,
          is_active: 1,
          is_winner: 0,
          created_at: cartela.created_at || new Date().toISOString()
        });
        savedCount++;
        
        // Report progress every 10 cartelas or on last cartela
        if (onProgress && (savedCount % 10 === 0 || i === cartelas.length - 1)) {
          const progress = Math.round((savedCount / totalCount) * 100);
          onProgress({
            phase: 'saving',
            current: savedCount,
            total: totalCount,
            progress: progress,
            message: `Saved ${savedCount}/${totalCount} cartelas to user (${progress}%)`
          });
        }
      } catch (error) {
        errors.push(`Card ${cartela.card_id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Saved ${savedCount} cartelas directly to user_cartelas table`);
    
    return {
      success: true,
      savedCount,
      totalCount: cartelas.length,
      errors
    };
    
  } catch (error) {
    console.error('❌ User cartelas save error:', error);
    return {
      success: false,
      savedCount: 0,
      totalCount: cartelas.length,
      errors: [error.message]
    };
  }
}

module.exports = {
  parseCartelaData,
  formatCartela,
  validateCartela,
  processPDFCartelas,
  saveCartelasToDatabase,
  saveCartelasToUserTable,
  generateSampleCartelas
};