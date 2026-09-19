if (process.env.NODE_ENV === 'production') {
  await import('./production.mjs');
} else {
  await import('./preview.mjs');
}
