import { Body, Controller, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { CobrancasService } from './cobrancas.service';

type ReqAuth = { empresaId: string };

@Controller('cobrancas-boleto')
@UseGuards(PapelGuard)
export class CobrancasController {
  constructor(private service: CobrancasService) {}

  private assertInterMock() {
    if (process.env.INTER_USE_MOCK !== 'true') {
      throw new NotFoundException();
    }
  }

  @Post(':id/simular-pagamento-mock')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  simularMock(
    @Param('id') id: string,
    @Req() req: ReqAuth,
    @Body()
    body: { valor_total_recebido: number; juros?: number; multa?: number; desconto?: number },
  ) {
    this.assertInterMock();
    return this.service.simularPagamentoMock(id, req.empresaId, {
      valorTotalRecebido: body.valor_total_recebido,
      juros: body.juros,
      multa: body.multa,
      desconto: body.desconto,
    });
  }

  @Post(':id/simular-pagamento-cobv-mock')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  simularCobvMock(
    @Param('id') id: string,
    @Req() req: ReqAuth,
    @Body() body: { valor: number; juros?: number; multa?: number; desconto?: number },
  ) {
    this.assertInterMock();
    return this.service.simularPagamentoCobvMock(id, req.empresaId, body);
  }
}