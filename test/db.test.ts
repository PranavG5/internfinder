import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { preferTransactionPooler, toDollarParams } from '../src/lib/db';

const SESSION = 'postgresql://postgres.abcdef:pw@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

describe('preferTransactionPooler', () => {
  it('moves a Supabase pooler off session mode', () => {
    const url = new URL(preferTransactionPooler(SESSION));
    assert.equal(url.port, '6543');
    assert.equal(url.hostname, 'aws-1-us-east-1.pooler.supabase.com');
    assert.equal(url.username, 'postgres.abcdef');
    assert.equal(url.password, 'pw');
    assert.equal(url.pathname, '/postgres');
  });

  it('leaves a pooler already in transaction mode alone', () => {
    const already = SESSION.replace(':5432', ':6543');
    assert.equal(new URL(preferTransactionPooler(already)).port, '6543');
  });

  it('leaves a direct database connection alone', () => {
    // Direct connections also listen on 5432 but are not pooled, so rewriting
    // the port would point at nothing.
    const direct = 'postgresql://postgres:pw@db.abcdef.supabase.co:5432/postgres';
    assert.equal(preferTransactionPooler(direct), direct);
  });

  it('leaves a local database alone', () => {
    const local = 'postgresql://postgres:pw@localhost:5432/internindex';
    assert.equal(preferTransactionPooler(local), local);
  });

  it('passes through a string it cannot parse', () => {
    const kv = 'host=localhost port=5432 dbname=internindex';
    assert.equal(preferTransactionPooler(kv), kv);
  });
});

describe('toDollarParams', () => {
  it('numbers placeholders in order', () => {
    assert.equal(
      toDollarParams('SELECT * FROM t WHERE a = ? AND b = ? AND c = ?'),
      'SELECT * FROM t WHERE a = $1 AND b = $2 AND c = $3',
    );
  });

  it('leaves a statement without placeholders untouched', () => {
    assert.equal(toDollarParams('SELECT 1'), 'SELECT 1');
  });
});
