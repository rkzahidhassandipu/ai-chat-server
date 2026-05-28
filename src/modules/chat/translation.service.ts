import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('LIBRETRANSLATE_URL', 'http://localhost:5001');
  }

  async translateText(text: string, targetLang: string): Promise<string> {
    if (!text?.trim()) return text;

    try {
      const res = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: 'auto',
          target: targetLang,
          format: 'text',
        }),
      });

      const data = await res.json();
      return data.translatedText || text;
    } catch (error) {
      this.logger.error(`Translation failed: ${error.message}`);
      return text;
    }
  }
}