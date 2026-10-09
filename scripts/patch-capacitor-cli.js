// @capacitor/cli 6 imports the default export of `tar` (v6). We force tar 7.x
// (security fixes) through package.json "resolutions", and v7 has no default
// export, so `cap sync` crashed with "Cannot read properties of undefined
// (reading 'extract')". This makes the CLI accept both. Safe to run many times;
// does nothing when the CLI is not installed (e.g. production install).
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'node_modules', '@capacitor', 'cli', 'dist', 'util', 'template.js')
try {
  const src = fs.readFileSync(file, 'utf8')
  const from = 'await tar_1.default.extract('
  if (src.includes(from)) {
    fs.writeFileSync(file, src.replace(from, 'await (tar_1.default && tar_1.default.extract ? tar_1.default : tar_1).extract('))
    console.log('patched @capacitor/cli for tar 7')
  }
} catch (e) {
  // CLI not installed: nothing to patch
}
