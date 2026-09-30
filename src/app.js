'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const container = require('./container');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  const swaggerDoc = YAML.load(path.join(__dirname, '..', 'docs', 'swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
} catch (err) {
  console.warn('⚠️  Swagger doc not found – /api-docs disabled');
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'CineRate Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint không tồn tại' });
});

app.use(errorHandler);

module.exports = app;
