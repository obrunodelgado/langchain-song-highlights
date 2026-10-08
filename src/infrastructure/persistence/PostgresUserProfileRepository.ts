import type { Pool } from 'pg';
import type { UserProfileRepository } from '../../application/ports.ts';
import type { UserProfile } from '../../domain/profile.ts';

export class PostgresUserProfileRepository implements UserProfileRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async setup(): Promise<void> {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS song_user_profiles (
      user_id TEXT PRIMARY KEY,
      profile JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const result = await this.pool.query<{ profile: UserProfile }>(
      'SELECT profile FROM song_user_profiles WHERE user_id = $1', [userId]);
    return result.rows[0]?.profile ?? null;
  }

  async update(userId: string, transform: (current: UserProfile | null) => UserProfile): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Locks even when the profile does not exist yet. Released by COMMIT/ROLLBACK.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`song-profile:${userId}`]);
      const result = await client.query<{ profile: UserProfile }>(
        'SELECT profile FROM song_user_profiles WHERE user_id = $1', [userId]);
      const profile = transform(result.rows[0]?.profile ?? null);
      await client.query(`INSERT INTO song_user_profiles (user_id, profile)
        VALUES ($1, $2::jsonb) ON CONFLICT (user_id)
        DO UPDATE SET profile = EXCLUDED.profile, updated_at = NOW()`, [userId, JSON.stringify(profile)]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
