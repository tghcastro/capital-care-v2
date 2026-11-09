function readPackage(pkg) {
  // Allow build scripts for native dependencies
  if (['better-sqlite3', 'es5-ext', 'esbuild'].includes(pkg.name)) {
    pkg.pnpm = pkg.pnpm || {};
    pkg.pnpm.allowBuild = true;
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
