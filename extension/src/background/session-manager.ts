/**
 * U:Echo — Session Manager
 * Creates, persists, and resumes EchoSession objects via chrome.storage.local.
 */

import type { EchoSession, OverlayMode } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';

export class SessionManager {
  private session: EchoSession | null = null;

  async getOrCreate(tabUrl: string): Promise<EchoSession> {
    if (this.session && this.session.tab_url === tabUrl) {
      return this.session;
    }

    // Try to resume from storage
    const stored = await this.loadFromStorage();
    if (stored && stored.tab_url === tabUrl) {
      this.session = stored;
      this.session.updated_at = Date.now();
      await this.persist();
      return this.session;
    }

    // Create new session
    this.session = {
      session_id: crypto.randomUUID(),
      user_id: 'local-user',
      tab_url: tabUrl,
      overlay_mode: 'off' as OverlayMode,
      agent_active: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await this.persist();
    return this.session;
  }

  getCurrent(): EchoSession | null {
    return this.session;
  }

  async updateMode(mode: OverlayMode): Promise<void> {
    if (!this.session) return;
    this.session.overlay_mode = mode;
    this.session.updated_at = Date.now();
    await this.persist();
  }

  async setAgentActive(active: boolean): Promise<void> {
    if (!this.session) return;
    this.session.agent_active = active;
    this.session.updated_at = Date.now();
    await this.persist();
  }

  async destroy(): Promise<void> {
    this.session = null;
    await chrome.storage.local.remove(STORAGE_KEYS.session);
  }

  // ─── Internal ─────────────────────────────────────────────────

  private async persist(): Promise<void> {
    if (!this.session) return;
    await chrome.storage.local.set({
      [STORAGE_KEYS.session]: JSON.stringify(this.session),
    });
  }

  private async loadFromStorage(): Promise<EchoSession | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.session);
    const raw = result[STORAGE_KEYS.session];
    if (!raw) return null;

    try {
      return JSON.parse(raw) as EchoSession;
    } catch {
      return null;
    }
  }
}
