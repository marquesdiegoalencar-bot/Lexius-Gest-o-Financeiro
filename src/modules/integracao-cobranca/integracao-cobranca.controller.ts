import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
  receberAcordo(@Body() dto: ReceberAcordoDto) {
    return this.service.receberAcordo(dto);
  }
}