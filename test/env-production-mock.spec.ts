import 'reflect-metadata';
import { envValidation } from '../src/config/env.validation';

describe('envValidation production fail-closed', () => {
  const base = {
    DATABASE_URL: 'postgresql://localhost/test',
    JWT_SECRET: 'x'.repeat(32),
    COB_INTEGRACAO_API_KEY: 'k',
    COB_INTEGRACAO_HMAC_SECRET: 'h',
  };

  it('recusa INTER_USE_MOCK em production', () => {
    expect(() =>
      envValidation({ ...base, NODE_ENV: 'production', INTER_USE_MOCK: 'true' }),
    ).toThrow(/INTER_USE_MOCK/);
  });

  it('recusa WEBHOOK_INTER_MOCK_SECRET em production', () => {
    expect(() =>
      envValidation({
        ...base,
        NODE_ENV: 'production',
        WEBHOOK_INTER_MOCK_SECRET: 'x',
      }),
    ).toThrow(/WEBHOOK_INTER_MOCK_SECRET/);
  });
});