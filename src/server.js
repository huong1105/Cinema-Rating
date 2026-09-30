'use strict';

require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 CineRate API running on http://localhost:${PORT}`);
  console.log(`📚 Swagger docs  → http://localhost:${PORT}/api-docs`);
  console.log(`🌍 Environment   → ${process.env.NODE_ENV || 'development'}`);
});
