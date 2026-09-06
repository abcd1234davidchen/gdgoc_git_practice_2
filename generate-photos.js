const fs = require("node:fs");
const path = require("node:path");

const memberDirectory = path.join(__dirname, "members");
const outputFile = path.join(__dirname, "photos.js");
const imagePattern = /\.(avif|gif|jpe?g|png|webp)$/i;

function findImages(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) return findImages(absolutePath);
    if (!entry.isFile() || !imagePattern.test(entry.name)) return [];

    return path.relative(memberDirectory, absolutePath).split(path.sep).join("/");
  });
}

const photos = findImages(memberDirectory).sort((a, b) => a.localeCompare(b));
const contents = `// Generated automatically by generate-photos.js.\nwindow.PHOTOS = ${JSON.stringify(photos, null, 2)};\n`;

fs.writeFileSync(outputFile, contents);
console.log(`Found ${photos.length} photo${photos.length === 1 ? "" : "s"}.`);
