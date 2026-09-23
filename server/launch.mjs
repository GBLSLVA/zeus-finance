const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

if (isProduction) {
  await import('./production.mjs');
} else {
  await import('./preview.mjs');
}
