import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { RequirePapeis } from '../../common/decorators/papeis.decorator';
import { PapelGuard } from '../../common/guards/papel.guard';
import { PapelUsuario } from '../../database/enums';
import { ConfirmarRateioDto } from './dto/confirmar-rateio.dto';
import { IniciarRateioDto } from './dto/iniciar-rateio.dto';
import { SalvarRateioItensDto } from './dto/salvar-rateio-itens.dto';
import { RateioService } from './rateio.service';

@Controller('rateio')
@UseGuards(PapelGuard)
export class RateioController {
  constructor(private service: RateioService) {}

  @Post('titulos-receber/:tituloId/rascunho')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO, PapelUsuario.OPERADOR)
  rascunhoReceber(
    @Param('tituloId') tituloId: string,
    @Req() req: { empresaId: string },
    @Body() dto: IniciarRateioDto,
  ) {
    return this.service.rascunhoReceber(req.empresaId, tituloId, dto);
  }

  @Post('titulos-pagar/:tituloId/rascunho')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO, PapelUsuario.OPERADOR)
  rascunhoPagar(
    @Param('tituloId') tituloId: string,
    @Req() req: { empresaId: string },
    @Body() dto: IniciarRateioDto,
  ) {
    return this.service.rascunhoPagar(req.empresaId, tituloId, dto);
  }

  @Get('definicoes/:definicaoId')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  obter(@Param('definicaoId') definicaoId: string, @Req() req: { empresaId: string }) {
    return this.service.obterDefinicao(definicaoId, req.empresaId);
  }

  @Put('definicoes/:definicaoId/itens')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO, PapelUsuario.OPERADOR)
  salvarItens(
    @Param('definicaoId') definicaoId: string,
    @Req() req: { empresaId: string },
    @Body() dto: SalvarRateioItensDto,
  ) {
    return this.service.salvarItens(definicaoId, req.empresaId, dto);
  }

  @Patch('definicoes/:definicaoId/cancelar')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  cancelar(@Param('definicaoId') definicaoId: string, @Req() req: { empresaId: string }) {
    return this.service.cancelarRascunho(definicaoId, req.empresaId);
  }

  @Post('definicoes/:definicaoId/confirmar')
  @RequirePapeis(PapelUsuario.MASTER, PapelUsuario.ADMIN, PapelUsuario.FINANCEIRO)
  confirmar(
    @Param('definicaoId') definicaoId: string,
    @Req() req: { empresaId: string },
    @Body() dto: ConfirmarRateioDto,
  ) {
    return this.service.confirmar(definicaoId, req.empresaId, dto);
  }

  @Get('titulos-receber/:tituloId/historico')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  historicoReceber(@Param('tituloId') tituloId: string, @Req() req: { empresaId: string }) {
    return this.service.historicoDefinicoes(req.empresaId, { receberId: tituloId });
  }

  @Get('titulos-pagar/:tituloId/historico')
  @RequirePapeis(
    PapelUsuario.MASTER,
    PapelUsuario.ADMIN,
    PapelUsuario.FINANCEIRO,
    PapelUsuario.OPERADOR,
    PapelUsuario.CONSULTA,
  )
  historicoPagar(@Param('tituloId') tituloId: string, @Req() req: { empresaId: string }) {
    return this.service.historicoDefinicoes(req.empresaId, { pagarId: tituloId });
  }
}