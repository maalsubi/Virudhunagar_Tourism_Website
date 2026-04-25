/**
 * seedNeo4j.js
 * Loads all tourist places and edges into Neo4j.
 *
 * Run once:  node seedNeo4j.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');
const { getSession, driver } = require('./db');

const places = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'places_cleaned_new.json')));
const edges  = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'edges_cleaned.json')));

// ── helpers ────────────────────────────────────────────────────────────────
const safeFloat = (v, def = 0) => (v == null || isNaN(v) ? def : parseFloat(v));
const safeInt   = (v, def = 0) => (v == null || isNaN(v) ? def : parseInt(v, 10));

// ── main ──────────────────────────────────────────────────────────────────
async function seed() {
  const session = getSession();
  console.log('🌱 Starting Neo4j seed...');

  try {
    // 1. Clear existing data
    console.log('  Clearing old data...');
    await session.run('MATCH (n) DETACH DELETE n');

    // 2. Constraints & indexes
    console.log('  Creating constraints...');
    await session.run('CREATE CONSTRAINT place_id IF NOT EXISTS FOR (p:Place) REQUIRE p.place_id IS UNIQUE');
    await session.run('CREATE INDEX place_taluk IF NOT EXISTS FOR (p:Place) ON (p.taluk)');
    await session.run('CREATE INDEX place_category IF NOT EXISTS FOR (p:Place) ON (p.category)');

    // 3. Insert Place nodes
    console.log(`  Inserting ${places.length} Place nodes...`);
    for (const p of places) {
      await session.run(
        `CREATE (p:Place {
          place_id:         $place_id,
          name:             $name,
          taluk:            $taluk,
          category:         $category,
          latitude:         $latitude,
          longitude:        $longitude,
          address:          $address,
          rating:           $rating,
          popularity:       $popularity,
          photo_url:        $photo_url,
          description:      $description,
          source:           $source
        })`,
        {
          place_id:    p.place_id,
          name:        p.name,
          taluk:       p.taluk,
          category:    p.category,
          latitude:    safeFloat(p.latitude),
          longitude:   safeFloat(p.longitude),
          address:     p.address || '',
          rating:      safeFloat(p.rating, 3.5),
          popularity:  safeInt(p.popularity, 0),
          photo_url:   p.photo_url || '',
          description: p.description || '',
          source:      p.source || 'unknown',
        }
      );
    }

    // 4. Insert CONNECTED_TO relationships
    console.log(`  Inserting ${edges.length} CONNECTED_TO relationships...`);
    for (const e of edges) {
      await session.run(
        `MATCH (a:Place {name: $src_name}), (b:Place {name: $tgt_name})
         MERGE (a)-[r:CONNECTED_TO {
           edge_id:         $edge_id,
           distance_km:     $dist,
           time_car:        $tc,
           time_bus:        $tb,
           time_2w:         $t2,
           time_cycle:      $tcy,
           weight_car:      $wc,
           strength:        $strength,
           same_taluk:      $same_taluk,
           connection_type: $conn_type
         }]->(b)`,
        {
          src_name:  e.source_name,
          tgt_name:  e.target_name,
          edge_id:   e.edge_id,
          dist:      safeFloat(e.distance_km),
          tc:        safeInt(e.time_car),
          tb:        safeInt(e.time_bus),
          t2:        safeInt(e.time_2w),
          tcy:       safeInt(e.time_cycle),
          wc:        safeFloat(e.weight_car),
          strength:  e.strength || 'medium',
          same_taluk: e.same_taluk === true,
          conn_type: e.connection_type || 'unknown',
        }
      );
    }

    // 5. Verification
    const countRes = await session.run('MATCH (p:Place) RETURN count(p) AS cnt');
    const edgeRes  = await session.run('MATCH ()-[r:CONNECTED_TO]->() RETURN count(r) AS cnt');
    console.log(`✅ Seeded ${countRes.records[0].get('cnt')} nodes, ${edgeRes.records[0].get('cnt')} edges`);
    console.log('🎉 Seed complete!');
  } catch (err) {
    console.error('❌ Seed error:', err);
    throw err;
  } finally {
    await session.close();
    await driver.close();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });