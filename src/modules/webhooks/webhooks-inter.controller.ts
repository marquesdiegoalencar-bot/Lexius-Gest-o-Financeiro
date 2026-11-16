import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { InterWebhookAuthGuard } from './inter-webhook-auth.guard';
import { WebhooksInterService } from './webhooks-inter.service';

@Controller('webhooks')
export class WebhooksInterController {
  constructor(private service: WebhooksInterService) {}

  @Public()
  @Post('inter')
  @UseGuards(InterWebhookAuthGuard)
  receber(@Body() body: Record<string, unknown>, @Req() req: { client?: { authorized?: boolean } }) {
    return this.service.receber(body, req.client?.authorized === true);
  }
}