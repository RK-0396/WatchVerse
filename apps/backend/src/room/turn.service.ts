import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class TurnService {
  private readonly logger = new Logger(TurnService.name);

  // Retrieve environment configurations with sensible defaults
  private readonly turnSecret = process.env.TURN_SECRET ?? 'supersecretturnkeychangeinproduction';
  private readonly turnRealm = process.env.TURN_REALM ?? 'turn.watchverse.com';
  private readonly turnHost = process.env.TURN_HOST ?? 'localhost';
  private readonly turnPort = process.env.TURN_PORT ?? '3478';

  /**
   * Generates dynamic dynamic HMAC-SHA1 credentials for Coturn TURN Server.
   * Based on standard REST API auth specifications (RFC 5766).
   */
  generateCredentials(userId: string) {
    // Check if custom TURN credentials are provided in the environment
    const customUrls = process.env.TURN_URLS;
    const customUsername = process.env.TURN_USERNAME;
    const customCredential = process.env.TURN_CREDENTIAL;

    if (customUrls && customUsername && customCredential) {
      this.logger.log(`Using custom environment TURN credentials for user: ${userId}`);
      const urlsArray = customUrls.split(',').map(url => url.trim());
      return {
        iceServers: [
          {
            urls: [
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302'
            ]
          },
          {
            urls: urlsArray,
            username: customUsername,
            credential: customCredential
          }
        ],
        ttl: 24 * 3600
      };
    }

    // 1. Establish expiration time (e.g., 24 hours in the future)
    const expirySeconds = Math.floor(Date.now() / 1000) + 24 * 3600;

    // 2. Generate username: timestamp:username
    const username = `${expirySeconds}:${userId}`;

    try {
      // 3. Compute HMAC-SHA1 signature using TURN_SECRET as key
      const hmac = crypto.createHmac('sha1', this.turnSecret);
      hmac.update(username);
      const credential = hmac.digest('base64');

      this.logger.log(`Generated ephemeral TURN credentials for user: ${userId}`);

      // 4. Construct WebRTC iceServers configuration array
      return {
        iceServers: [
          // STUN endpoints (standard direct NAT discovery)
          {
            urls: [
              `stun:${this.turnHost}:${this.turnPort}`,
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302'
            ]
          },
          // TURN UDP and TCP relay fallbacks (dynamic HMAC credentials)
          {
            urls: [
              `turn:${this.turnHost}:${this.turnPort}?transport=udp`,
              `turn:${this.turnHost}:${this.turnPort}?transport=tcp`
            ],
            username: username,
            credential: credential
          },
          // Open Relay Project (Metered.ca) global fallbacks for cross-network mobile/ngrok testing
          {
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        ttl: 24 * 3600
      };
    } catch (error) {
      this.logger.error('Failed to generate TURN dynamic credentials', error);
      throw error;
    }
  }
}
