require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const { bingoCards, generateBingoCard } = require('../data/cartela.js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    // Delete all existing cartelas
    const { error: deleteError } = await supabase
      .from('cartelas')
      .delete()
      .neq('id', 0);

    if (deleteError) throw deleteError;

    console.log('All existing cartelas deleted successfully.');

    // Insert new cartelas from the file
    let insertedCount = 0;
    for (const [cardIdStr, numbers] of Object.entries(bingoCards)) {
      const cardId = parseInt(cardIdStr);
      const { error } = await supabase
        .from('cartelas')
        .insert({
          id: cardId,
          numbers: numbers  // Assuming 'numbers' column accepts array/JSON
        });

      if (error) {
        console.error(`Error inserting card ${cardId}:`, error.message);
      } else {
        insertedCount++;
        if (insertedCount % 100 === 0) {
          console.log(`Inserted ${insertedCount} cartelas so far...`);
        }
      }
    }

    console.log(`Successfully added ${insertedCount} cartelas to the database.`);
  } catch (error) {
    console.error('Error during operation:', error.message);
  } finally {
    await supabase.destroy();
  }
}

main();
