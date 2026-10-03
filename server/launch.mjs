const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  await import('./production.mjs');
} else {
  await import('./preview.mjs');
}
