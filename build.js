const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const memberDirectory = path.join(__dirname, "members");
const distDirectory = path.join(__dirname, "dist");
const distMemberDirectory = path.join(distDirectory, "members");
const imagePattern = /\.(avif|gif|jpe?g|png|webp)$/i;

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function findImageFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) return findImageFiles(absolutePath);
    if (!entry.isFile() || !imagePattern.test(entry.name)) return [];
    if (entry.name.toLowerCase() === "readme.md") return [];

    return absolutePath;
  });
}

async function build() {
  console.log("🚀 Starting build process...");

  // 1. Clean and initialize dist/
  if (fs.existsSync(distDirectory)) {
    fs.rmSync(distDirectory, { recursive: true, force: true });
  }
  fs.mkdirSync(distMemberDirectory, { recursive: true });

  // 2. Copy static web assets
  const staticFiles = ["index.html", "style.css", "script.js"];
  for (const file of staticFiles) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(distDirectory, file));
    }
  }

  // 3. Scan and optimize images
  const imageFiles = findImageFiles(memberDirectory);
  console.log(`📸 Found ${imageFiles.length} member photo(s) to optimize.`);

  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;
  const photoEntries = [];

  for (const srcPath of imageFiles) {
    const relFromMembers = path.relative(memberDirectory, srcPath);
    const parsed = path.parse(relFromMembers);
    const targetRelPath = path.join(parsed.dir, `${parsed.name}.webp`);
    const targetAbsPath = path.join(distMemberDirectory, targetRelPath);

    fs.mkdirSync(path.dirname(targetAbsPath), { recursive: true });

    const originalStats = fs.statSync(srcPath);
    totalOriginalBytes += originalStats.size;

    const isGif = parsed.ext.toLowerCase() === ".gif";

    try {
      await sharp(srcPath, { animated: isGif })
        .resize({
          width: 400,
          height: 400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: 80,
          effort: 4,
        })
        .toFile(targetAbsPath);

      const optimizedStats = fs.statSync(targetAbsPath);
      totalOptimizedBytes += optimizedStats.size;

      const normalizedPath = targetRelPath.split(path.sep).join("/");
      photoEntries.push(normalizedPath);

      console.log(
        `  ✓ ${relFromMembers} (${formatBytes(originalStats.size)}) -> ${normalizedPath} (${formatBytes(optimizedStats.size)})`
      );
    } catch (err) {
      console.warn(`  ⚠️ Failed to optimize ${relFromMembers}, copying original:`, err.message);
      // Fallback: copy original if sharp fails
      const fallbackAbsPath = path.join(distMemberDirectory, relFromMembers);
      fs.copyFileSync(srcPath, fallbackAbsPath);
      totalOptimizedBytes += originalStats.size;
      const normalizedPath = relFromMembers.split(path.sep).join("/");
      photoEntries.push(normalizedPath);
    }
  }

  // 4. Generate dist/photos.js
  photoEntries.sort((a, b) => a.localeCompare(b));
  const photosJsContent = `// Generated automatically by build.js.\nwindow.PHOTOS = ${JSON.stringify(
    photoEntries,
    null,
    2
  )};\n`;
  fs.writeFileSync(path.join(distDirectory, "photos.js"), photosJsContent);

  // 5. Output Summary
  const savedBytes = totalOriginalBytes - totalOptimizedBytes;
  const savedPercent = totalOriginalBytes > 0 ? ((savedBytes / totalOriginalBytes) * 100).toFixed(1) : 0;

  console.log("\n✨ Build completed successfully!");
  console.log(`📦 Output directory: ${distDirectory}`);
  console.log(`📊 Image Optimization Summary:`);
  console.log(`   - Original size:  ${formatBytes(totalOriginalBytes)}`);
  console.log(`   - Optimized size: ${formatBytes(totalOptimizedBytes)}`);
  console.log(`   - Bandwidth saved: ${formatBytes(savedBytes)} (-${savedPercent}%)`);
}

build().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});

