import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './ai-provider.js';
import { OpenRouterProvider } from './providers/openrouter.provider.js';

@Module({
  providers: [
    OpenRouterProvider,
    {
      provide: AI_PROVIDER,
      useExisting: OpenRouterProvider,
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
