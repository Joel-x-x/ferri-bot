import * as dotenv from 'dotenv';
dotenv.config({ override: true });
import * as Joi from 'joi';

const schema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  PG_HOST: Joi.string().required(),
  PG_PORT: Joi.number().default(5434),
  PG_USER: Joi.string().required(),
  PG_PASSWORD: Joi.string().required(),
  PG_DATABASE: Joi.string().required(),

  JWT_SECRET: Joi.string().required(),
  JWT_ISSUER: Joi.string().default('ferridescuentos'),

  ENCRYPTION_KEY: Joi.string().min(32).required(),

  FRONTEND_URL: Joi.string().default('http://localhost:4200'),

  META_API_VERSION: Joi.string().default('v22.0'),

  ALGOLIA_APP_ID: Joi.string().required(),
  ALGOLIA_SEARCH_KEY: Joi.string().required(),
  ALGOLIA_INDEX_NAME: Joi.string().default('products'),

  GROQ_API_KEY: Joi.string().allow('').optional(),
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  STT_PROVIDER: Joi.string().valid('groq', 'openai').default('groq'),
  STT_FALLBACK_PROVIDER: Joi.string().valid('groq', 'openai').default('openai'),
  STT_ENABLED: Joi.boolean().default(true),

});

const { error, value } = schema.validate(process.env, { allowUnknown: true });

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const envs = {
  port: value.PORT as number,
  nodeEnv: value.NODE_ENV as string,

  pg: {
    host: value.PG_HOST as string,
    port: value.PG_PORT as number,
    username: value.PG_USER as string,
    password: value.PG_PASSWORD as string,
    database: value.PG_DATABASE as string,
  },

  jwt: {
    secret: value.JWT_SECRET as string,
    issuer: value.JWT_ISSUER as string,
  },

  encryptionKey: value.ENCRYPTION_KEY as string,
  frontendUrl: value.FRONTEND_URL as string,

  meta: {
    apiVersion: value.META_API_VERSION as string,
  },

  algolia: {
    appId: value.ALGOLIA_APP_ID as string,
    searchKey: value.ALGOLIA_SEARCH_KEY as string,
    indexName: value.ALGOLIA_INDEX_NAME as string,
  },

  stt: {
    provider: value.STT_PROVIDER as string,
    fallbackProvider: value.STT_FALLBACK_PROVIDER as string,
    enabled: value.STT_ENABLED as boolean,
  },
};
