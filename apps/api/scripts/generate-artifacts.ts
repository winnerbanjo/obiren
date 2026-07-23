import * as fs from 'fs';
import * as path from 'path';

const openApiDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Obiren Production Monolith API',
    version: '1.0.0',
    description: 'Production API specification for Obiren Women Health, Safety, and Clinical Ecosystem',
  },
  servers: [{ url: 'http://localhost:3000/api/v1', description: 'Local Development Server' }],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register new Obiren user',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  countryCode: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: { '201': { description: 'User registered' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login user and receive JWT access & refresh tokens',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { email: { type: 'string' }, password: { type: 'string' } },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: { '200': { description: 'Authenticated successfully' } },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate refresh token and get new access token',
        responses: { '200': { description: 'Token rotated' } },
      },
    },
    '/users/me': {
      get: { summary: 'Get current user profile', security: [{ bearerAuth: [] }] },
      patch: { summary: 'Update user profile', security: [{ bearerAuth: [] }] },
    },
    '/cycles/current': {
      get: { summary: 'Get current active cycle and day of cycle', security: [{ bearerAuth: [] }] },
    },
    '/cycles/start-period': {
      post: { summary: 'Start period and calculate cycle predictions', security: [{ bearerAuth: [] }] },
    },
    '/daily-logs/{date}': {
      get: { summary: 'Get daily log for specific date', security: [{ bearerAuth: [] }] },
      put: { summary: 'Upsert daily log', security: [{ bearerAuth: [] }] },
    },
    '/pregnancies/current': {
      get: { summary: 'Get active pregnancy gestational week & due date', security: [{ bearerAuth: [] }] },
    },
    '/directory/search': {
      get: { summary: 'Search 31 verified emergency & healthcare records' },
    },
    '/directory/nearby': {
      get: { summary: 'Geospatial 2dsphere nearby emergency search' },
    },
    '/health-vault/upload-intent': {
      post: { summary: 'Generate Cloudinary server-side upload signature', security: [{ bearerAuth: [] }] },
    },
    '/health-vault/documents/{id}': {
      get: { summary: 'Get 5-minute signed download URL with access log', security: [{ bearerAuth: [] }] },
    },
    '/safety/sos/trigger': {
      post: { summary: 'Trigger Web SOS panic alert', security: [{ bearerAuth: [] }] },
    },
    '/safety/sos/cancel': {
      post: { summary: 'Cancel active SOS with Safety PIN', security: [{ bearerAuth: [] }] },
    },
    '/admin/metrics': {
      get: { summary: 'Admin global metrics & MongoDB aggregations', security: [{ bearerAuth: [] }] },
    },
    '/health': {
      get: { summary: 'System readiness check' },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

const postmanCollection = {
  info: {
    name: 'Obiren Production API Collection',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: 'Auth',
      item: [
        { name: 'Register', request: { method: 'POST', url: '{{baseUrl}}/auth/register' } },
        { name: 'Login', request: { method: 'POST', url: '{{baseUrl}}/auth/login' } },
        { name: 'Refresh Token', request: { method: 'POST', url: '{{baseUrl}}/auth/refresh' } },
      ],
    },
    {
      name: 'Cycles',
      item: [
        { name: 'Current Cycle', request: { method: 'GET', url: '{{baseUrl}}/cycles/current' } },
        { name: 'Start Period', request: { method: 'POST', url: '{{baseUrl}}/cycles/start-period' } },
      ],
    },
    {
      name: 'Pregnancy',
      item: [
        { name: 'Current Pregnancy', request: { method: 'GET', url: '{{baseUrl}}/pregnancies/current' } },
      ],
    },
    {
      name: 'Directory',
      item: [
        { name: 'Search Directory', request: { method: 'GET', url: '{{baseUrl}}/directory/search?countryCode=NG' } },
        { name: 'Nearby Directory', request: { method: 'GET', url: '{{baseUrl}}/directory/nearby?lng=3.3792&lat=6.5244' } },
      ],
    },
    {
      name: 'Admin',
      item: [
        { name: 'Admin Metrics', request: { method: 'GET', url: '{{baseUrl}}/admin/metrics' } },
      ],
    },
  ],
};

fs.writeFileSync(path.join(__dirname, '../openapi.json'), JSON.stringify(openApiDoc, null, 2));
fs.writeFileSync(path.join(__dirname, '../postman_collection.json'), JSON.stringify(postmanCollection, null, 2));
console.log('✅ Generated openapi.json and postman_collection.json successfully.');
