import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CobIntegracaoGuard } from '../../common/guards/cob-integracao.guard';
import { ReceberAcordoDto } from './dto/receber-acordo.dto';
import { IntegracaoCobrancaService } from './integracao-cobranca.service';

@Controller('integracao/cobranca')
export class IntegracaoCobrancaController {
  constructor(private service: IntegracaoCobrancaService) {}

  @Public()
  @UseGuards(CobIntegracaoGuard)
  @Post('acordos')
  async receberAcordo(@Body() dto: ReceberAcordoDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.receberAcordo(dto);
    res.status(result.idempotente ? 200 : 201);
    return result;
  }
}