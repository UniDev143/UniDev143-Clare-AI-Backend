// ═══════════════════════════════════════════════════════════
// PROMPT TEST HARNESS
// Usage:
//   node test/testAnalysis.js                → test all images in test/images/
//   node test/testAnalysis.js --repeat 3     → run each image 3x (consistency check)
// ═══════════════════════════════════════════════════════════
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { analyseSkin } = require('../services/skinAnalysisService');

const IMAGES_DIR  = path.join(__dirname, 'images');
const RESULTS_DIR = path.join(__dirname, 'results');

const args    = process.argv.slice(2);
const repeatIdx = args.indexOf('--repeat');
const REPEAT  = repeatIdx !== -1 ? parseInt(args[repeatIdx + 1]) || 1 : 1;

const pad = (s, n) => String(s).padEnd(n);

(async () => {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log(`Created ${IMAGES_DIR} — put test .jpg/.png files there and rerun.`);
    process.exit(0);
  }
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const files = fs.readdirSync(IMAGES_DIR)
    .filter(f => /\.(jpe?g|png)$/i.test(f));

  if (files.length === 0) {
    console.log('No images found in test/images/ — add some and rerun.');
    process.exit(0);
  }

  console.log(`\nTesting ${files.length} image(s), ${REPEAT}x each\n`);
  console.log(pad('IMAGE', 28) + pad('RUN', 5) + pad('VALID', 7) +
              pad('TYPE', 13) + pad('HEALTH', 8) + pad('ACNE', 6) +
              pad('OIL', 6) + pad('D.CIRC', 8) + pad('CONF', 8) + 'TIME');
  console.log('─'.repeat(95));

  const allResults = [];

  for (const file of files) {
    const filePath  = path.join(IMAGES_DIR, file);
    const imageData = fs.readFileSync(filePath).toString('base64');
    const mimeType  = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    for (let run = 1; run <= REPEAT; run++) {
      const start = Date.now();
      try {
        const result  = await analyseSkin(imageData, mimeType, null);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);

        if (result.rejected) {
          console.log(pad(file, 28) + pad(run, 5) + pad('REJ', 7) +
                      pad(result.rejectionReason, 13) + '—');
        } else {
          const d = result.data;
          console.log(
            pad(file, 28) + pad(run, 5) + pad('OK', 7) +
            pad(d.skinType, 13) + pad(d.overallSkinHealth, 8) +
            pad(d.conditions.acne.score, 6) +
            pad(d.conditions.oiliness.score, 6) +
            pad(d.conditions.dark_circles.score, 8) +
            pad(d.confidence, 8) + `${elapsed}s`
          );
        }

        allResults.push({ file, run, ...result });
      } catch (err) {
        console.log(pad(file, 28) + pad(run, 5) + `ERROR: ${err.message}`);
        allResults.push({ file, run, error: err.message });
      }
    }
  }

  // Save full JSON for detailed review
  const stamp   = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(RESULTS_DIR, `run-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\nFull results saved: test/results/run-${stamp}.json\n`);

  process.exit(0);
})();