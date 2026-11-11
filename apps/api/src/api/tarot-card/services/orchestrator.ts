import Replicate from 'replicate';
import { factories } from '@strapi/strapi';
import axios from 'axios';

const MASTER_PROMPT = `CRITICAL MANDATORY REQUIREMENT: This card MUST feature ONLY two elements of text/symbolism: A large [ZODIAC_ICON] symbol at the TOP and the single Polish word „[NAZWA]" at the BOTTOM. ABSOLUTELY NO OTHER WORDS, NO TITLES, NO CAPTIONS, NO EXTRA LETTERS, NO MODEL NAMES, NO SECONDARY TEXT allowed anywhere on the composition.

Luxury vertical tarot card (9:16), exclusive collectible astrological design, composition fills almost the entire card while maintaining an elegant internal padding at all edges, TOP CENTER: large majestic golden [ZODIAC_ICON] ZODIAC SYMBOL (glowing like a forged astral sign), BOTTOM CENTER: beautiful label containing ONLY AND EXCLUSIVELY THE SINGLE WORD: „[NAZWA]" in elegant mystical calligraphy with gold foil gilding and subtle radiance. CENTER: [SPECIFIC_PROMPT] (magnetic, hypnotic, most detailed central focus, majestic mystical personification or symbolic object representing [NAZWA]), colors: dominant [KOLOR_MOTYWU] theme with soft tonal transitions and subtle light reflections, BACKGROUND: deep black cosmic void, featuring [KONSTELACJA] constellation with thin constellation lines and fine stardust, strictly secondary to the center, LIGHTING: soft cinematic light focused on the central figure, delicate astral aura, premium fantasy editorial art, 8k ultra-detailed masterpiece`;

const MASTER_PROMPT_DAILY = `CRITICAL MANDATORY REQUIREMENT: This card MUST feature ONLY two elements of text/symbolism: A large golden mystical star symbol [✧] at the TOP and the single Polish word „[NAZWA]" at the BOTTOM. ABSOLUTELY NO OTHER WORDS, NO TITLES, NO CAPTIONS allowed.

Luxury vertical tarot card (2:3), exclusive collectible astrological design, composition fills almost the entire card with elegant internal padding. TOP CENTER: large majestic golden ✧ star icon (glowing with astral energy). BOTTOM CENTER: beautiful label containing ONLY the single word: „[NAZWA]" in elegant mystical calligraphy with gold foil gilding. CENTER: [SPECIFIC_PROMPT] (magnetic, majestic focal point, highly detailed), colors: dominant [KOLOR_MOTYWU] theme, BACKGROUND: deep black cosmic void, LIGHTING: cinematic focus, premium fantasy editorial art, 8k ultra-detailed masterpiece`;

export default factories.createCoreService(
  'api::tarot-card.tarot-card',
  ({ strapi }) => ({
    async generateDailyCardSample(
      cardName: string,
      specificPrompt: string,
      colorMotif = 'gold and iridescent white',
    ) {
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      });

      const fullPrompt = MASTER_PROMPT_DAILY.replace(/\[NAZWA\]/g, cardName)
        .replace('[SPECIFIC_PROMPT]', specificPrompt)
        .replace('[KOLOR_MOTYWU]', colorMotif);

      strapi.log.info(`Inicjowanie generowania Karty Dnia: ${cardName}`);

      try {
        const output = (await replicate.run('openai/gpt-image-2', {
          input: {
            prompt: fullPrompt,
            aspect_ratio: '2:3',
          },
        })) as any;

        return String(Array.isArray(output) ? output[0] : output);
      } catch (error) {
        strapi.log.error(
          `Błąd generowania obrazu dla ${cardName}: ${error.message}`,
        );
        throw error;
      }
    },

    async generateImageSample(
      cardName: string,
      specificPrompt: string,
      overrides: { colorMotif?: string; constellation?: string } = {},
    ) {
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      });

      const icons: Record<string, string> = {
        Panna: '♍️',
        Waga: '♎️',
        Skorpion: '♏️',
        Strzelec: '♐️',
        Koziorożec: '♑️',
        Wodnik: '♒️',
        Ryby: '♓️',
        Baran: '♈️',
        Byk: '♉️',
        Bliźnięta: '♊️',
        Rak: '♋️',
        Lew: '♌️',
      };

      const colorMotifs: Record<string, string> = {
        Panna: 'earthy sage green and gold',
        Waga: 'soft rose and airy blue',
        Skorpion: 'deep crimson and dark obsidian',
        Strzelec: 'royal purple and fiery orange',
        Koziorożec: 'dark onyx and slate grey',
        Wodnik: 'electric blue and silver',
        Ryby: 'shimmering aquamarine and seafoam',
        Baran: 'burning scarlet and iron red',
        Byk: 'emerald green and rich gold',
        Bliźnięta: 'bright yellow and light silver',
        Rak: 'pearly white and moonlit silver',
        Lew: 'radiant solar gold and sun orange',
      };

      const constellations: Record<string, string> = {
        Panna: 'Virgo',
        Waga: 'Libra',
        Skorpion: 'Scorpius',
        Strzelec: 'Sagittarius',
        Koziorożec: 'Capricornus',
        Wodnik: 'Aquarius',
        Ryby: 'Pisces',
        Baran: 'Aries',
        Byk: 'Taurus',
        Bliźnięta: 'Gemini',
        Rak: 'Cancer',
        Lew: 'Leo',
      };

      const fullPrompt = MASTER_PROMPT.replace(/\[NAZWA\]/g, cardName)
        .replace('[SPECIFIC_PROMPT]', specificPrompt)
        .replace('[ZODIAC_ICON]', icons[cardName] || '✨')
        .replace(
          '[KONSTELACJA]',
          overrides.constellation || constellations[cardName] || cardName,
        )
        .replace(
          '[KOLOR_MOTYWU]',
          overrides.colorMotif ||
            colorMotifs[cardName] ||
            'gold and astral blue',
        );

      strapi.log.info(`Inicjowanie generowania (Flux 2 Pro) dla: ${cardName}`);

      try {
        const output = (await replicate.run('openai/gpt-image-2', {
          input: {
            prompt: fullPrompt,
            aspect_ratio: '2:3',
          },
        })) as any;

        let resultUrl = '';
        if (
          output &&
          (typeof output.getReader === 'function' ||
            output.constructor?.name === 'ReadableStream')
        ) {
          const chunks: Uint8Array[] = [];
          for await (const chunk of output as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          const fs = require('fs');
          const path = require('path');
          const fileName = `preview-${cardName.toLowerCase()}-${Date.now()}.webp`;
          const publicDir = path.join(process.cwd(), 'public');
          const filePath = path.join(publicDir, 'uploads', fileName);

          if (!fs.existsSync(path.join(publicDir, 'uploads'))) {
            fs.mkdirSync(path.join(publicDir, 'uploads'), { recursive: true });
          }

          fs.writeFileSync(filePath, buffer);
          resultUrl = `/uploads/${fileName}`;
        } else {
          resultUrl = Array.isArray(output) ? output[0] : output;
        }

        return resultUrl;
      } catch (error) {
        strapi.log.error(
          `Błąd generowania obrazu dla ${cardName}: ${error.message}`,
        );
        throw error;
      }
    },

    async generateAllCards(
      cards: Array<{
        cardName: string;
        specificPrompt: string;
        glyph: string;
        colorMotif: string;
        constellation: string;
      }>,
    ) {
      strapi.log.info(
        `Rozpoczynam generowanie seryjne dla ${cards.length} kart.`,
      );

      const results = [];

      for (const cardData of cards) {
        try {
          strapi.log.info(`Przetwarzanie karty: ${cardData.cardName}...`);

          // 1. Generowanie obrazu
          let imageUrl = await this.generateImageSample(
            cardData.cardName,
            cardData.specificPrompt,
            {
              colorMotif: cardData.colorMotif,
              constellation: cardData.constellation,
            },
          );

          imageUrl = String(imageUrl); // Wymuszenie typu string
          strapi.log.info(`DEBUG: imageUrl = ${imageUrl}`);

          // 2. Pobieranie bufora
          let buffer: Buffer;
          if (imageUrl && imageUrl.startsWith('http')) {
            strapi.log.info(`DEBUG: Pobieranie zdalne...`);
            const response = await axios.get(imageUrl, {
              responseType: 'arraybuffer',
            });
            buffer = Buffer.from(response.data, 'binary');
          } else if (imageUrl) {
            strapi.log.info(`DEBUG: Odczyt lokalny...`);
            const fs = require('fs');
            const path = require('path');
            const publicDir = path.join(process.cwd(), 'public');
            const filePath = path.join(publicDir, imageUrl);
            strapi.log.info(`DEBUG: filePath = ${filePath}`);
            buffer = fs.readFileSync(filePath);
          } else {
            throw new Error('imageUrl is undefined');
          }

          strapi.log.info(`DEBUG: Buffer size = ${buffer.length}`);

          // 3. Upload do Strapi Media Library
          strapi.log.info(`DEBUG: Inicjowanie uploadu (Temp File Strategy)...`);
          const fs = require('fs');
          const path = require('path');
          const uploadService = strapi.plugin('upload').service('upload');

          const publicDir = path.join(process.cwd(), 'public');
          const tmpDir = path.join(publicDir, 'uploads', 'tmp');
          if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
          }

          const tmpPath = path.join(
            tmpDir,
            `tmp_${cardData.cardName.toLowerCase()}_${Date.now()}.webp`,
          );
          fs.writeFileSync(tmpPath, buffer);
          strapi.log.info(`DEBUG: Temp file created at: ${tmpPath}`);

          const uploadedFiles = await uploadService.upload({
            data: {
              fileInfo: {
                alternativeText: `Karta Tarota: ${cardData.cardName}`,
                caption: `Star Sign Editorial`,
                name: `tarot_${cardData.cardName.toLowerCase()}.webp`,
              },
            },
            files: {
              filepath: tmpPath, // W Strapi 5 kluczowa jest nazwa 'filepath'
              originalFilename: `tarot_${cardData.cardName.toLowerCase()}.webp`,
              name: `tarot_${cardData.cardName.toLowerCase()}.webp`,
              type: 'image/webp',
              size: buffer.length,
            },
          });

          // Cleanup
          if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
            strapi.log.info(`DEBUG: Temp file cleaned up.`);
          }

          const fileId = uploadedFiles[0].id;

          // 4. Aktualizacja/Utworzenie wpisu TarotCard (opcjonalnie, jeśli istnieje model)
          const existingCards = await strapi.entityService.findMany(
            'api::tarot-card.tarot-card',
            {
              filters: { name: cardData.cardName },
            },
          );

          if (existingCards.length > 0) {
            await strapi.entityService.update(
              'api::tarot-card.tarot-card',
              existingCards[0].id,
              {
                data: { image: fileId } as any,
              },
            );
          }

          results.push({ cardName: cardData.cardName, fileId });
          strapi.log.info(`✅ Sukces dla ${cardData.cardName}`);
        } catch (error) {
          strapi.log.error(
            `❌ KRYTYCZNY BŁĄD podczas generowania ${cardData.cardName}: ${error.message}`,
          );
          console.error(error.stack); // Wyświetlamy pełny stack trace w konsoli
          strapi.log.error(
            `Przerywam generowanie seryjne, aby uniknąć kosztów.`,
          );
          throw new Error(
            `Przerwano seryjne generowanie na karcie ${cardData.cardName}: ${error.message}`,
          );
        }
      }

      return results;
    },

    async commitImage(cardId: number, imageUrl: string) {
      // ... (zachowujemy dla kompatybilności wstecznej lub usuwamy jeśli generateAllCards wystarcza)
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      const buffer = Buffer.from(response.data, 'binary');

      const card = await strapi.entityService.findOne(
        'api::tarot-card.tarot-card',
        cardId,
      );

      const uploadService = strapi.plugin('upload').service('upload');

      const uploadedFiles = await uploadService.upload({
        data: {
          fileInfo: {
            alternativeText: `Karta Tarota: ${card.name}`,
            caption: `Star Sign Editorial`,
            name: `tarot_${card.slug}.webp`,
          },
        },
        files: {
          path: imageUrl,
          name: `tarot_${card.slug}.webp`,
          type: 'image/webp',
          size: buffer.length,
          buffer: buffer,
        },
      });

      await strapi.entityService.update('api::tarot-card.tarot-card', cardId, {
        data: {
          image: uploadedFiles[0].id,
        } as any,
      });

      return uploadedFiles[0];
    },
  }),
);
