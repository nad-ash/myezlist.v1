/**
 * Image Migration Script
 * 
 * Migrates images from Base44 Supabase storage to your own Supabase storage bucket.
 * 
 * Prerequisites:
 * 1. Create a storage bucket called 'images' in your Supabase project
 * 2. Make the bucket PUBLIC (Storage → images → Settings → Public bucket)
 * 3. Set your environment variables or update the constants below
 * 
 * Run with: node scripts/migrate-images.js
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURATION - Update these values!
// ============================================

// Your Supabase credentials (use service role key for admin access)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vknyeuikdlrnvkrrbhwm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY_HERE';

// Storage bucket name (create this in Supabase Dashboard → Storage)
const STORAGE_BUCKET = 'images';

// Base44 URL pattern to detect and migrate
const BASE44_PATTERN = 'qtrypzzcjebvfcihiynt.supabase.co';

// ============================================
// SCRIPT - Don't modify below this line
// ============================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Stats tracking
const stats = {
  total: 0,
  migrated: 0,
  failed: 0,
  skipped: 0
};

/**
 * Download image from URL
 */
async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to download`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload image to Supabase storage
 */
async function uploadImage(buffer, filename) {
  // Determine content type from filename
  const ext = filename.split('.').pop().toLowerCase();
  const contentTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  const contentType = contentTypes[ext] || 'image/png';

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, buffer, {
      contentType,
      upsert: true
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

/**
 * Extract filename from URL
 */
function extractFilename(url) {
  try {
    const urlPath = new URL(url).pathname;
    const parts = urlPath.split('/');
    return parts[parts.length - 1] || 'image.png';
  } catch {
    return 'image.png';
  }
}

/**
 * Migrate a single table
 */
async function migrateTable(tableName, idColumn = 'id') {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📦 Migrating table: ${tableName}`);
  console.log('='.repeat(50));

  // Get all records with Base44 URLs
  const { data: records, error } = await supabase
    .from(tableName)
    .select(`${idColumn}, photo_url`)
    .not('photo_url', 'is', null)
    .like('photo_url', `%${BASE44_PATTERN}%`);

  if (error) {
    console.error(`❌ Error fetching ${tableName}:`, error.message);
    return;
  }

  if (!records || records.length === 0) {
    console.log(`✓ No Base44 images found in ${tableName}`);
    return;
  }

  console.log(`Found ${records.length} records with Base44 URLs\n`);
  stats.total += records.length;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const progress = `[${i + 1}/${records.length}]`;

    try {
      const oldUrl = record.photo_url;
      const originalFilename = extractFilename(oldUrl);
      const newFilename = `${tableName}/${record[idColumn]}_${originalFilename}`;

      process.stdout.write(`${progress} ${record[idColumn]}: Downloading... `);

      // Download from Base44
      const imageBuffer = await downloadImage(oldUrl);
      
      process.stdout.write(`Uploading... `);

      // Upload to your bucket
      const newUrl = await uploadImage(imageBuffer, newFilename);

      // Update database record
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ photo_url: newUrl })
        .eq(idColumn, record[idColumn]);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }

      stats.migrated++;
      console.log(`✅ Done`);
      console.log(`   Old: ${oldUrl.substring(0, 60)}...`);
      console.log(`   New: ${newUrl}`);

    } catch (err) {
      stats.failed++;
      console.log(`❌ Failed: ${err.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     🚀 Base44 to Supabase Image Migration Script         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nTarget: ${SUPABASE_URL}`);
  console.log(`Bucket: ${STORAGE_BUCKET}`);
  console.log(`Pattern: ${BASE44_PATTERN}`);

  // Validate configuration
  if (SUPABASE_SERVICE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
    console.error('\n❌ ERROR: Please set your SUPABASE_SERVICE_ROLE_KEY!');
    console.error('   Get it from: Supabase Dashboard → Settings → API → service_role (secret)\n');
    process.exit(1);
  }

  // Check if bucket exists
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error('\n❌ ERROR: Could not list buckets:', bucketError.message);
    console.error('   Make sure your service role key is correct.\n');
    process.exit(1);
  }

  const bucketExists = buckets.some(b => b.name === STORAGE_BUCKET);
  if (!bucketExists) {
    console.log(`\n📁 Creating storage bucket: ${STORAGE_BUCKET}...`);
    const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true
    });
    if (createError) {
      console.error(`❌ Failed to create bucket: ${createError.message}`);
      console.error('   Please create it manually in Supabase Dashboard → Storage\n');
      process.exit(1);
    }
    console.log('✅ Bucket created successfully!');
  } else {
    console.log(`\n✅ Bucket '${STORAGE_BUCKET}' exists`);
  }

  // Migrate each table
  await migrateTable('common_items');
  await migrateTable('items');
  await migrateTable('recipes');

  // Print summary
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                    📊 Migration Summary                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n   Total found:  ${stats.total}`);
  console.log(`   ✅ Migrated:  ${stats.migrated}`);
  console.log(`   ❌ Failed:    ${stats.failed}`);
  console.log(`   ⏭️  Skipped:   ${stats.skipped}`);
  console.log('\n');

  if (stats.failed > 0) {
    console.log('⚠️  Some images failed to migrate. You may need to:');
    console.log('   - Check if those images still exist in Base44');
    console.log('   - Re-run the script to retry failed items\n');
  }

  if (stats.migrated > 0) {
    console.log('✅ Migration complete! Your images are now stored in your Supabase bucket.');
    console.log('   You can safely shut off your Base44 account after verifying.\n');
  }
}

// Run the migration
main().catch(err => {
  console.error('\n❌ Migration failed with error:', err);
  process.exit(1);
});
